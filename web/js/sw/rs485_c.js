/* DesignOrbit.ai — the C driver of the RS-485 link, WRITTEN BY THE TOOL from its model (sw/rs485_link.js) : the same frame,
   the same CRC, the same silent intervals — and a test program that replays the frames printed by others, so that the C
   compiled on any computer gives back what the model gives (the back-to-back test the roadmap asks for, in small).
   Plain C99 : no allocation, fixed-width types, no library of a maker. It is a SKELETON : the four functions that touch
   the microcontroller (the DE pin, the UART, « transmission complete », a microsecond clock) are left to the project —
   they are the hardware / software interface, named after the pins of the board.
   Pure : → files as text. Every file carries the note of the platform. */

import { FOOT_NOTE_ASCII } from "../core/brand.js";
import { RTU, RTU_VECTORS, rtuFrame, charTime, silences, replayVectors } from "./rs485_link.js";

const us = (s) => Math.round(s * 1e6), hx = (b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`;
const head = (name, what) => `/* ${name} - ${what}\n * ${FOOT_NOTE_ASCII}\n * Written by the tool from its model of the link: the same frame, the same CRC, the same silent intervals.\n * Protocol: MODBUS RTU, as an example of a protocol on RS-485 (MODBUS over Serial Line V1.02: frame and silent\n * intervals p. 13, character p. 12, CRC p. 39). A SKELETON: read it, test it, and review it as any code you ship.\n */\n`;

/** The files of the driver. o : { baud (19200), pins: [{ sw, signal, mcu, net }] (the hardware / software interface of the board, for the comment), board } → [{ name, text }] */
export function cDriver(o = {}) {
  const baud = o.baud || RTU.baud, S = silences(baud), lead = us(1 / baud), pins = (o.pins || []).map((p) => ` *   ${String(p.sw).padEnd(18)} ${String(p.mcu || "(not connected)").padEnd(12)} ${p.signal === "RO" ? "<-" : "->"} ${String(p.signal).padEnd(8)} net ${p.net || "-"}`).join("\n");
  const h = `${head("rs485_link.h", "RS-485 half-duplex link, MODBUS RTU framing")}#ifndef RS485_LINK_H
#define RS485_LINK_H

#include <stddef.h>
#include <stdint.h>

/* ---- the link, as the model has it ---- */
#define RS485_BAUD          ${baud}u
#define RS485_CHAR_BITS     ${RTU.bits}u      /* 1 start, 8 data (LSB first), 1 parity (even), 1 stop */
#define RS485_CHAR_US       ${us(charTime(baud))}u     /* one character on the line */
#define RS485_T15_US        ${us(S.t15)}u     /* 1.5 characters: a longer gap inside a frame makes it incomplete */
#define RS485_T35_US        ${us(S.t35)}u    /* 3.5 characters: the silence that ends a frame, and that precedes one */
#define RS485_DE_LEAD_US    ${lead}u      /* the driver is enabled one bit before the first start bit */
#define RS485_FRAME_MAX     ${RTU.max}u

/* ---- the hardware / software interface${o.board ? ` of board ${o.board}` : ""} ----
 * software symbol     MCU pin         transceiver
${pins || " *   (no board given: name the pins of your own)"}
 * These four functions are the only ones that touch the microcontroller: write them for yours.
 */
typedef struct {
    void     (*de)(uint8_t on);                         /* DE and /RE tied together: 1 = this node drives the bus */
    void     (*write)(const uint8_t *bytes, size_t n);  /* hand n bytes to the UART: 8 data bits, even parity, 1 stop */
    uint8_t  (*tx_complete)(void);                      /* 1 once the LAST stop bit has left the pin - not "buffer empty" */
    uint32_t (*now_us)(void);                           /* a free-running microsecond counter (it may wrap) */
} rs485_port_t;

typedef enum { RS485_IDLE = 0, RS485_SENDING = 1, RS485_RECEIVING = 2 } rs485_state_t;
typedef enum { RS485_NONE = 0, RS485_FRAME = 1, RS485_BAD_CRC = 2, RS485_BROKEN = 3 } rs485_event_t;

typedef struct {
    const rs485_port_t *port;
    rs485_state_t       state;
    const uint8_t      *tx;          /* the frame being sent: the caller keeps it alive until the link is idle */
    size_t              tx_len;
    uint8_t             tx_started;
    uint32_t            t0_us;       /* when DE was raised */
    uint8_t             rx[RS485_FRAME_MAX];
    uint16_t            rx_len;      /* valid after RS485_FRAME, until the next byte arrives */
    uint8_t             broken;
    uint32_t            last_us;     /* the last activity seen on the line */
} rs485_link_t;

uint16_t      rs485_crc16(const uint8_t *bytes, size_t n);
size_t        rs485_frame(uint8_t *out, size_t cap, uint8_t addr, uint8_t fn, const uint8_t *data, size_t n);
uint8_t       rs485_frame_ok(const uint8_t *bytes, size_t n);
void          rs485_init(rs485_link_t *l, const rs485_port_t *port);
uint8_t       rs485_send(rs485_link_t *l, const uint8_t *frame, size_t n);   /* 1: taken ; 0: the bus is not free yet */
void          rs485_on_byte(rs485_link_t *l, uint8_t byte);                 /* call it from the UART receive interrupt */
rs485_event_t rs485_poll(rs485_link_t *l);                                  /* call it from the main loop */

#endif /* RS485_LINK_H */
`;
  const c = `${head("rs485_link.c", "RS-485 half-duplex link, MODBUS RTU framing")}#include "rs485_link.h"

/* CRC-16 of MODBUS: register loaded with 0xFFFF; each byte XORed into the low byte, then 8 shifts to the right -
 * when the bit shifted out is 1, XOR with 0xA001. Its LOW byte goes first on the wire. */
uint16_t rs485_crc16(const uint8_t *bytes, size_t n)
{
    uint16_t crc = 0x${RTU.init.toString(16).toUpperCase()}u;
    size_t i;
    uint8_t k;
    for (i = 0u; i < n; i++) {
        crc = (uint16_t)(crc ^ bytes[i]);
        for (k = 0u; k < 8u; k++) {
            crc = (crc & 1u) ? (uint16_t)((crc >> 1) ^ 0x${RTU.poly.toString(16).toUpperCase()}u) : (uint16_t)(crc >> 1);
        }
    }
    return crc;
}

/* A frame ready for the wire: address, function, data, CRC low, CRC high. Returns its length, 0 when it cannot be one. */
size_t rs485_frame(uint8_t *out, size_t cap, uint8_t addr, uint8_t fn, const uint8_t *data, size_t n)
{
    size_t i;
    uint16_t crc;
    if (addr > 247u || fn == 0u || fn > 127u || n > 252u || cap < n + 4u) {
        return 0u;
    }
    out[0] = addr;
    out[1] = fn;
    for (i = 0u; i < n; i++) {
        out[2u + i] = data[i];
    }
    crc = rs485_crc16(out, n + 2u);
    out[n + 2u] = (uint8_t)(crc & 0xFFu);
    out[n + 3u] = (uint8_t)(crc >> 8);
    return n + 4u;
}

uint8_t rs485_frame_ok(const uint8_t *bytes, size_t n)
{
    uint16_t crc;
    if (n < 4u || n > RS485_FRAME_MAX) {
        return 0u;
    }
    crc = rs485_crc16(bytes, n - 2u);
    return (uint8_t)((bytes[n - 2u] == (uint8_t)(crc & 0xFFu)) && (bytes[n - 1u] == (uint8_t)(crc >> 8)));
}

void rs485_init(rs485_link_t *l, const rs485_port_t *port)
{
    l->port = port;
    l->state = RS485_IDLE;
    l->tx = 0;
    l->tx_len = 0u;
    l->tx_started = 0u;
    l->rx_len = 0u;
    l->broken = 0u;
    l->t0_us = port->now_us();
    l->last_us = (uint32_t)(l->t0_us - RS485_T35_US);   /* the bus is taken as silent at start-up */
    port->de(0u);                                       /* this node listens */
}

/* Takes the bus for one frame - only when the link is idle and the line has been silent for 3.5 characters. */
uint8_t rs485_send(rs485_link_t *l, const uint8_t *frame, size_t n)
{
    uint32_t now = l->port->now_us();
    if (l->state != RS485_IDLE || n == 0u || n > RS485_FRAME_MAX || (uint32_t)(now - l->last_us) < RS485_T35_US) {
        return 0u;
    }
    l->tx = frame;
    l->tx_len = n;
    l->tx_started = 0u;
    l->t0_us = now;
    l->state = RS485_SENDING;
    l->port->de(1u);                                    /* the driver first; the bytes follow in rs485_poll() */
    return 1u;
}

/* One byte from the UART. While this node sends, its receiver is off (/RE follows DE): nothing is expected. */
void rs485_on_byte(rs485_link_t *l, uint8_t byte)
{
    uint32_t now = l->port->now_us();
    if (l->state == RS485_SENDING) {
        return;
    }
    if (l->state == RS485_IDLE) {
        l->rx_len = 0u;
        l->broken = 0u;
        l->state = RS485_RECEIVING;
    } else if ((uint32_t)(now - l->last_us) > RS485_T15_US) {
        l->broken = 1u;                                 /* a gap of more than 1.5 characters inside the frame */
    }
    if (l->rx_len < RS485_FRAME_MAX) {
        l->rx[l->rx_len] = byte;
        l->rx_len++;
    } else {
        l->broken = 1u;
    }
    l->last_us = now;
}

rs485_event_t rs485_poll(rs485_link_t *l)
{
    uint32_t now = l->port->now_us();
    rs485_event_t ev = RS485_NONE;
    if (l->state == RS485_SENDING) {
        if (l->tx_started == 0u) {
            if ((uint32_t)(now - l->t0_us) >= RS485_DE_LEAD_US) {
                l->port->write(l->tx, l->tx_len);
                l->tx_started = 1u;
            }
        } else if (l->port->tx_complete() != 0u) {
            l->port->de(0u);                            /* the last stop bit has left: give the bus back */
            l->state = RS485_IDLE;
            l->last_us = now;
        }
    } else if (l->state == RS485_RECEIVING && (uint32_t)(now - l->last_us) >= RS485_T35_US) {
        if (l->broken != 0u) {
            ev = RS485_BROKEN;
        } else {
            ev = (rs485_frame_ok(l->rx, l->rx_len) != 0u) ? RS485_FRAME : RS485_BAD_CRC;
        }
        l->state = RS485_IDLE;
        l->broken = 0u;
    }
    return ev;
}
`;
  const vec = RTU_VECTORS.map((v) => `    { "${v.id}", { ${v.bytes.map(hx).join(", ")} }, ${v.bytes.length}u },`).join("\n");
  const t = `${head("rs485_link_test.c", "what the driver must give back, on any computer")}/* Build:  cc -std=c99 -Wall -Wextra -pedantic -o rs485_link_test rs485_link.c rs485_link_test.c
 * Run:    ./rs485_link_test      (it prints one line per check, then ALL PASS)
 * The frames are PRINTED by others - the MODBUS specification and a public tutorial: see rs485_vectors.txt. */
#include <stdio.h>
#include "rs485_link.h"

typedef struct { const char *id; uint8_t bytes[16]; size_t n; } vector_t;
static const vector_t VECTORS[] = {
${vec}
};

/* a port made of variables: a clock one moves by hand, and what was done to the pins */
static uint32_t now_us_v; static uint8_t de_v, done_v; static size_t written_v; static uint32_t de_at, write_at;
static void t_de(uint8_t on) { de_v = on; if (on) { de_at = now_us_v; } }
static void t_write(const uint8_t *b, size_t n) { (void)b; written_v = n; write_at = now_us_v; }
static uint8_t t_done(void) { return done_v; }
static uint32_t t_now(void) { return now_us_v; }
static const rs485_port_t PORT = { t_de, t_write, t_done, t_now };

static int failed;
static void check(const char *what, int ok) { printf("%s %s\\n", ok ? "ok  " : "FAIL", what); if (!ok) { failed = 1; } }

int main(void)
{
    static rs485_link_t link;
    uint8_t out[32];
    size_t i, k, n;
    rs485_event_t ev;

    for (i = 0u; i < sizeof VECTORS / sizeof VECTORS[0]; i++) {
        const vector_t *v = &VECTORS[i];
        uint16_t crc = rs485_crc16(v->bytes, v->n - 2u);
        int same = 1;
        n = rs485_frame(out, sizeof out, v->bytes[0], v->bytes[1], &v->bytes[2], v->n - 4u);
        for (k = 0u; k < v->n; k++) { if (n != v->n || out[k] != v->bytes[k]) { same = 0; } }
        printf("vector %s crc %02X %02X\\n", v->id, (unsigned)(crc & 0xFFu), (unsigned)(crc >> 8));
        check(v->id, same && rs485_frame_ok(v->bytes, v->n));
    }

    /* sending: DE first, the bytes one bit later, the bus given back on "transmission complete" only */
    now_us_v = 100000u; done_v = 0u; written_v = 0u;
    rs485_init(&link, &PORT);
    check("at start-up the node listens", de_v == 0u);
    check("a frame is taken when the bus is silent", rs485_send(&link, VECTORS[0].bytes, VECTORS[0].n) == 1u && de_v == 1u && written_v == 0u);
    (void)rs485_poll(&link);
    check("no byte leaves before the driver is enabled", written_v == 0u);
    now_us_v += RS485_DE_LEAD_US; (void)rs485_poll(&link);
    check("the bytes leave one bit after DE", written_v == VECTORS[0].n && (uint32_t)(write_at - de_at) == RS485_DE_LEAD_US);
    now_us_v += 4u * RS485_CHAR_US - 1u; (void)rs485_poll(&link);
    check("DE holds while the last bit is not out", de_v == 1u && rs485_send(&link, VECTORS[0].bytes, VECTORS[0].n) == 0u);
    done_v = 1u; now_us_v += 1u; (void)rs485_poll(&link);
    check("DE falls on transmission complete", de_v == 0u);
    check("the next frame waits for 3.5 characters of silence", rs485_send(&link, VECTORS[0].bytes, VECTORS[0].n) == 0u);

    /* receiving: a frame ends with 3.5 characters of silence */
    now_us_v += 10u * RS485_T35_US;
    for (k = 0u; k < VECTORS[1].n; k++) { rs485_on_byte(&link, VECTORS[1].bytes[k]); now_us_v += RS485_CHAR_US; }
    check("no frame before the silence", rs485_poll(&link) == RS485_NONE);
    now_us_v += RS485_T35_US; ev = rs485_poll(&link);
    check("a frame after 3.5 characters of silence", ev == RS485_FRAME && link.rx_len == VECTORS[1].n);
    for (k = 0u; k < VECTORS[1].n; k++) { rs485_on_byte(&link, (uint8_t)(VECTORS[1].bytes[k] ^ (k == 3u ? 0x04u : 0u))); now_us_v += RS485_CHAR_US; }
    now_us_v += RS485_T35_US; ev = rs485_poll(&link);
    check("one bit wrong: the CRC says so", ev == RS485_BAD_CRC);
    for (k = 0u; k < VECTORS[1].n; k++) { rs485_on_byte(&link, VECTORS[1].bytes[k]); now_us_v += RS485_CHAR_US + (k == 2u ? RS485_T15_US + 1u : 0u); }
    now_us_v += RS485_T35_US; ev = rs485_poll(&link);
    check("a gap of more than 1.5 characters: the frame is thrown away", ev == RS485_BROKEN);

    printf("%s\\n", failed ? "SOME FAILED" : "ALL PASS");
    return failed;
}
`;
  const vt = ["RS-485 link - the frames the driver and the model must both give back", "", ...RTU_VECTORS.flatMap((v) => [`${v.id}`, `  bytes on the wire : ${v.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")}`, `  printed as        : ${v.printed}`, `  source            : ${v.source} - ${v.where}`, `  ${v.url}`, ""]), "The bytes were copied from the pages as printed; the model and the C are both checked against them.", FOOT_NOTE_ASCII].join("\n");
  return [{ name: "rs485_link.h", text: h }, { name: "rs485_link.c", text: c }, { name: "rs485_link_test.c", text: t }, { name: "rs485_vectors.txt", text: vt }];
}
/** What the test program prints when everything passes, line by line — said by the MODEL : the C compiled on a computer must print the same. */
export function cExpected() {
  const R = replayVectors(), v = R.flatMap((r) => [`vector ${r.id} crc ${r.crc}`, `ok   ${r.id}`]);
  return [...v, "ok   at start-up the node listens", "ok   a frame is taken when the bus is silent", "ok   no byte leaves before the driver is enabled", "ok   the bytes leave one bit after DE", "ok   DE holds while the last bit is not out", "ok   DE falls on transmission complete", "ok   the next frame waits for 3.5 characters of silence",
    "ok   no frame before the silence", "ok   a frame after 3.5 characters of silence", "ok   one bit wrong: the CRC says so", "ok   a gap of more than 1.5 characters: the frame is thrown away", "ALL PASS"];
}
export { rtuFrame };
