/* DynamiteOrbit.ai — the RS-485 example board, written by tools/gen_demo_rs485.mjs : a small measuring node that answers on an
   RS-485 bus, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */

export const DEMO_RS485 = `dwiz board/1 NODE-485-PCBA "Nœud de mesure RS-485"
# DynamiteOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description "Reçoit le 5 V, mesure une température, et répond sur un bus RS-485 demi-duplex (MODBUS RTU, 19 200 bit/s) : l'exemple de la liaison, du bornier au pilote."
revision A
function F1 parent=null kind=principale name="Alimenter la logique à partir du 5 V" block=null
  criterion name=Rail level="3,3 V 0,2 A" flex=F1
function F2 parent=null kind=principale name="Calculer et tenir la liaison" block=null
  criterion name=Liaison level="UART 19 200 bit/s, 8 bits, parité paire" flex=F1
function F3 parent=null kind=principale name="Communiquer sur le bus RS-485" block=null
  criterion name=Bus level="demi-duplex, 8 nœuds, terminaison et polarisation sur cette carte" flex=F1
  criterion name=Protocole level="MODBUS RTU (exemple)" flex=F2
function F4 parent=null kind=principale name="Mesurer une température" block=null
  criterion name=Plage level="−20 à 100 °C, ± 2 K" flex=F1
function F5 parent=null kind=principale name="Signaler l'état" block=null
  criterion name=Témoin level=visible flex=F2
function F6 parent=null kind=principale name="Être testable et programmable" block=null
  criterion name=Accès level="connecteur de programmation, points de test sur les rails et le bus" flex=F1
function F7 parent=null kind=contrainte name="Tenir sur une petite carte" block=null
  criterion name=Carte level="54 × 44 mm" flex=F1
function F1.1 parent=F1 kind=technique name="Raccorder la carte : +5V,GND" block=B1 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique name="Réguler 5 V vers 3,3 V, 0,2 A, sans bruit de découpage" block=B2 auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 32 broches" block=B3
  auto=true
  criteria = []
function F3.1 parent=F3 kind=technique name="Communiquer en RS-485 demi-duplex" block=B4 auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 100 Hz" block=B5 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Signaler l'état par une DEL verte" block=B6 auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Programmer et déboguer le microcontrôleur" block=B7 auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Rendre la carte testable et plaçable en machine" block=B8 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_io name="Connecteur d'entrées-sorties" function=F1.1 zone=[1.5, 1.5, 12.5, 6] connect={P1: +5V, P2: GND}
  params signals="+5V,GND"
block B2 ldo name="Régulateur linéaire" function=F1.2 zone=[1.5, 8, 12.5, 18] connect={VIN: +5V, VOUT: +3V3, GND: GND}
  params vin=5 vout=3.3 iout=0.2
block B3 mcu name=Microcontrôleur function=F2.1 zone=[30.5, 1.5, 22, 25] connect={VDD: +3V3, GND: GND, NRST: RESET_N}
  params pins=32 xtal=8 vdd=3.3
block B4 rs485 name="Interface RS-485" function=F3.1 zone=[1.5, 26.5, 51.5, 16]
  connect={VCC: +5V, GND: GND, DI: UART_TX, RO: UART_RX, DE: RS485_DE, A: RS485_A, B: RS485_B}
  params term=1 bias=1 prot=1 conn=1 nodes=8 vdd=5
block B5 ntc name="Mesure de température par CTN" function=F4.1 zone=[14.5, 12.5, 12, 4.5]
  connect={VREF: +3V3, GND: GND, OUT: AIN0}
  params vref=3.3 rp=10 fc=100
block B6 led name="Témoin lumineux" function=F5.1 zone=[26.5, 1.5, 3.5, 25] connect={IN: LED_STATUS, GND: GND}
  params v=3.3 i=2 color=verte
block B7 conn_swd name="Connecteur de programmation" function=F6.1 zone=[14.5, 18, 12, 8]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B8 test name="Points de test et mires" function=F6.2 zone=[14.5, 1.5, 12, 11]
  connect={T1: +5V, T2: +3V3, T3: GND, T4: RS485_A, T5: RS485_B}
  params nets="+5V,+3V3,GND,RS485_A,RS485_B" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part J1 J-HDR-1x02 value="" block=B1 at=[7.75, 1.27] rot=0 side=top local=J role="Liaison vers l'extérieur de la carte"
  edge=true nc=[]
part U1 U-LDO-SOT223 value="3,3 V" block=B2 at=[7.5, 15] rot=90 side=top local=U role="Régule la tension"
part C1 C-0603 value="1 µF 16 V" block=B2 at=[7.5, 9.25] rot=180 side=top local=CIN role="Stabilise l'entrée" near=U1
part C2 C-0805 value="10 µF 16 V" block=B2 at=[3.75, 9] rot=180 side=top local=COUT role="Stabilise la sortie" near=U1
part U2 U-MCU-LQFP32 value="" block=B3 at=[38.25, 13.75] rot=0 side=top local=U role="Calcule, mesure et commande"
part C3 C-0603 value="100 nF" block=B3 at=[31.75, 17.5] rot=90 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U2
part C4 C-0603 value="100 nF" block=B3 at=[44.75, 10] rot=270 side=top local=CD2 role="Découplage de la broche 17"
  pin="17" near=U2
part C5 C-0805 value="4,7 µF" block=B3 at=[34.75, 20.5] rot=0 side=top local=CB role="Réserve locale" near=U2
part L1 FB-0603 value="600 Ω à 100 MHz" block=B3 at=[39, 7.25] rot=180 side=top local=FB
  role="Isole l'alimentation analogique" near=U2
part C6 C-0603 value="1 µF" block=B3 at=[31.75, 14] rot=90 side=top local=CA1 role="Découplage analogique" pin="5"
  near=U2
part C7 C-0603 value="10 nF" block=B3 at=[31.75, 10.5] rot=270 side=top local=CA2 role="Découplage analogique" pin="5"
  near=U2
part R1 R-0603 value="10 kΩ" block=B3 at=[31.75, 21] rot=270 side=top local=RR role="Rappel de la remise à zéro"
  near=U2
part C8 C-0603 value="100 nF" block=B3 at=[38.5, 20.25] rot=180 side=top local=CR role="Filtre la remise à zéro"
  near=U2
part R2 R-0603 value="10 kΩ" block=B3 at=[36, 22.75] rot=180 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U2
part Y1 Y-3225 value="8 MHz" block=B3 at=[35, 6.25] rot=180 side=top local=Y role="Base de temps" near=U2
part C9 C-0603 value="15 pF" block=B3 at=[35, 3.25] rot=180 side=top local=CX1 role="Charge du quartz" near=Y1
part C10 C-0603 value="15 pF" block=B3 at=[31.75, 6] rot=270 side=top local=CX2 role="Charge du quartz" near=Y1
part U3 U-RS485-SOIC8 value="" block=B4 at=[33.75, 31.75] rot=180 side=top local=U
  role="Traduit l'UART en paire différentielle"
part C11 C-0603 value="100 nF" block=B4 at=[28.75, 31.5] rot=90 side=top local=C role=Découplage near=U3
part R3 R-0603 value="10 kΩ" block=B4 at=[33.5, 35.75] rot=180 side=top local=RDE
  role="Tient l'émetteur coupé tant que le microcontrôleur n'a pas démarré" near=U3
part R4 R-1206 value="10 Ω" block=B4 at=[27.25, 34.75] rot=180 side=top local=RSA
  role="Limite le courant d'une surtension sur A (résistance tenant l'impulsion)" near=U3
part R5 R-1206 value="10 Ω" block=B4 at=[15.75, 34.25] rot=180 side=top local=RSB
  role="Limite le courant d'une surtension sur B (résistance tenant l'impulsion)" near=R4
part D1 D-TVS-485-SOT23 value="12 V" block=B4 at=[10.75, 36.25] rot=0 side=top local=D
  role="Écrête les deux lignes, au plus près du bornier"
part R6 R-1206 value="133 Ω 1 %" block=B4 at=[11.25, 39.75] rot=0 side=top local=RT role="Terminaison de ligne" near=D1
part R7 R-0603 value="549 Ω 1 %" block=B4 at=[14.5, 36.75] rot=180 side=top local=RBU
  role="Polarisation : tire A vers l'alimentation" near=D1
part R8 R-0603 value="549 Ω 1 %" block=B4 at=[10.5, 33.25] rot=0 side=top local=RBD
  role="Polarisation : tire B vers la masse" near=R7
part J2 J-TB-3-5.08 value="" block=B4 at=[4, 34.25] rot=270 side=top local=J
  role="Bornier du bus : 1 = A (D1), 2 = B (D0), 3 = commun" edge=true
part U4 NTC-0603 value="10 kΩ B 3950" block=B5 at=[25, 14.75] rot=0 side=top local=RT role="Sonde de température"
part R9 R-0603 value="10 kΩ 1 %" block=B5 at=[22.25, 15.5] rot=270 side=top local=RP role="Haut du pont diviseur"
  near=U4
part R10 R-0603 value="1 kΩ" block=B5 at=[20.25, 14] rot=270 side=top local=RF role="Filtre anti-repliement" near=U4
part C12 C-0603 value="1,5 µF" block=B5 at=[18.25, 14] rot=90 side=top local=CF role="Filtre anti-repliement" near=R10
part D2 LED-0603 value=verte block=B6 at=[28.5, 14.25] rot=0 side=top local=D role=Témoin
part R11 R-0603 value="680 Ω" block=B6 at=[29.25, 17] rot=270 side=top local=R role="Fixe le courant" near=D2
part J3 J-SWD-2x05 value="" block=B7 at=[24.5, 21.75] rot=90 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part TP1 TP-1.0 value=+5V block=B8 at=[15.25, 11.25] rot=0 side=top local=TP1 role="Accès de mesure à +5V"
part TP2 TP-1.0 value=+3V3 block=B8 at=[22.25, 11.75] rot=0 side=top local=TP2 role="Accès de mesure à +3V3"
part TP3 TP-1.0 value=GND block=B8 at=[18.75, 11.25] rot=0 side=top local=TP3 role="Accès de mesure à GND"
part TP4 TP-1.0 value=RS485_A block=B8 at=[24.25, 11.75] rot=0 side=top local=TP4 role="Accès de mesure à RS485_A"
part TP5 TP-1.0 value=RS485_B block=B8 at=[15.25, 9.25] rot=0 side=top local=TP5 role="Accès de mesure à RS485_B"
part FID1 FID-1.0 value="" block=B8 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B8 at=[51, 3] rot=0 side=top local=FID2 role="Repère optique de placement" corner=2
part FID3 FID-1.0 value="" block=B8 at=[16.5, 41] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
net +5V class=power voltage=5 current=0.2 pins=[J1.1, U1.VIN, C1.1, U3.VCC, C11.1, R7.1, TP1.TP]
net GND class=ground voltage=0 current=0
  pins=[J1.2, U1.GND, C1.2, C2.2, U2.VSS, C5.2, C6.2, C7.2, C8.2, R2.2, C3.2, C4.2, Y1.GND, C9.2, C10.2, U3.GND, C11.2, R3.2, D1.GND, R8.2, J2.3, U4.2, C12.2, D2.K, J3.3, J3.5, J3.9, TP3.TP]
net +3V3 class=power voltage=3.3 current=0.2
  pins=[U1.VOUT, C2.1, U2.VDD, C3.1, C4.1, C5.1, L1.1, R1.1, R9.1, J3.1, TP2.TP]
net B3_VDDA class=power voltage=3.3 current=0.02 pins=[U2.VDDA, L1.2, C6.1, C7.1]
net RESET_N class=signal voltage=0 current=0 pins=[U2.NRST, R1.2, C8.1, J3.10]
net B3_BOOT0 class=signal voltage=0 current=0 pins=[U2.BOOT0, R2.1]
net B3_OSC_IN class=signal voltage=0 current=0 pins=[U2.OSC_IN, Y1.X1, C9.1]
net B3_OSC_OUT class=signal voltage=0 current=0 pins=[U2.OSC_OUT, Y1.X2, C10.1]
net UART_TX class=signal voltage=0 current=0 pins=[U3.DI, U2.PA9]
net UART_RX class=signal voltage=0 current=0 pins=[U3.RO, U2.PA10]
net RS485_DE class=signal voltage=0 current=0 pins=[U3.DE, U3.RE_N, R3.1, U2.PB1]
net B4_A class=signal voltage=12 current=0 pins=[U3.A, R4.1]
net B4_B class=signal voltage=12 current=0 pins=[U3.B, R5.1]
net RS485_A class=signal voltage=12 current=0 pins=[R4.2, D1.IO1, R6.1, R7.2, J2.1, TP4.TP]
net RS485_B class=signal voltage=12 current=0 pins=[R5.2, D1.IO2, R6.2, R8.1, J2.2, TP5.TP]
net B5_DIV class=signal voltage=0 current=0 pins=[R9.2, U4.1, R10.1]
net AIN0 class=signal voltage=0 current=0 pins=[R10.2, C12.1, U2.PA0]
net LED_STATUS class=signal voltage=3.3 current=0 pins=[R11.1, U2.PA15]
net B6_A class=signal voltage=0 current=0 pins=[R11.2, D2.A]
net SWDIO class=signal voltage=0 current=0 pins=[J3.2, U2.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J3.4, U2.SWCLK]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[54, 44] r=1 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
plane GND in1
plane +3V3 in2
track +3V3 top w=0.5 pts=[[7.5, 11.85], [8, 11.25], [8.5, 11.25]]
track +3V3 top w=0.5 pts=[[7.5, 18.15], [9.25, 18.75], [9.75, 18.75]]
track +3V3 top w=0.5 pts=[[4.7, 9], [5, 8.5], [5.5, 8]]
track +3V3 top w=0.4 pts=[[34, 16.55], [33.25, 16.5], [32.75, 16.5]]
track +3V3 top w=0.4 pts=[[42.5, 10.95], [43.25, 11], [43.75, 11]]
track +3V3 top w=0.5 pts=[[31.75, 16.7], [31.5, 16.75], [30.75, 16.75]]
track +3V3 top w=0.5 pts=[[44.75, 10.8], [45, 11.25], [45, 11.75]]
track +3V3 top w=0.5 pts=[[33.8, 20.5], [33.5, 21], [32.75, 21]]
track +3V3 top w=0.5 pts=[[39.8, 7.25], [40.75, 7.25]]
track +3V3 top w=0.5 pts=[[31.75, 21.8], [32, 22.25], [32, 22.75]]
track +3V3 top w=0.5 pts=[[22.25, 16.3], [22.5, 16.75], [22.5, 17.25]]
track +3V3 top w=0.5 pts=[[22.25, 11.75], [21.25, 11.75]]
track GND top w=0.5 pts=[[5.2, 11.85], [5.75, 11.25], [6.25, 11.25]]
track GND top w=0.5 pts=[[6.7, 9.25], [6.5, 9.5], [6.5, 10.25]]
track GND top w=0.5 pts=[[2.8, 9], [1.75, 9]]
track GND top w=0.4 pts=[[41.05, 9.5], [41.25, 9.25], [41.75, 9.25]]
track GND top w=0.4 pts=[[35.45, 18], [34.75, 18]]
track GND top w=0.5 pts=[[35.7, 20.5], [36, 20.25], [36.75, 20.25]]
track GND top w=0.5 pts=[[31.75, 14.8], [31.5, 15], [30.75, 15]]
track GND top w=0.5 pts=[[31.75, 9.7], [32, 9.25], [32, 8.75]]
track GND top w=0.5 pts=[[37.7, 20.25], [37.25, 20.5], [37.25, 21.25]]
track GND top w=0.5 pts=[[35.2, 22.75], [34.25, 22.75]]
track GND top w=0.5 pts=[[31.75, 18.3], [32, 18], [32.75, 18]]
track GND top w=0.5 pts=[[44.75, 9.2], [45, 8.75], [45, 8.25]]
track GND top w=0.5 pts=[[36.1, 7.05], [35.5, 7.5], [35.5, 7.75], [35.25, 8]]
track GND top w=0.5 pts=[[33.9, 5.45], [33.25, 5.5], [32.75, 5.5]]
track GND top w=0.5 pts=[[34.2, 3.25], [33.25, 3.25]]
track GND top w=0.5 pts=[[31.75, 5.2], [32, 4.75], [32, 4.25]]
track GND top w=0.5 pts=[[31.05, 33.655], [31.75, 33.75], [32.25, 33.75]]
track GND top w=0.5 pts=[[28.75, 32.3], [28.5, 32.5], [27.75, 32.5]]
track GND top w=0.5 pts=[[32.7, 35.75], [31.75, 35.75]]
track GND top w=0.5 pts=[[11.85, 36.25], [11.5, 36.5], [11.25, 36.5], [11, 36.75]]
track GND top w=0.5 pts=[[11.3, 33.25], [12.25, 33.25]]
track GND top w=0.5 pts=[[25.8, 14.75], [26.75, 14.75]]
track GND top w=0.5 pts=[[18.25, 14.8], [18.5, 15.25], [18.5, 15.75]]
track GND top w=0.5 pts=[[27.7, 14.25], [27.25, 14], [27, 14], [26.75, 13.75]]
track GND top w=0.5 pts=[[18.75, 11.25], [19.75, 11.25]]
track B3_VDDA top w=0.15 pts=[[34, 13.35], [33.25, 13.25], [32, 13.25], [31.75, 13.2]]
track B3_VDDA top w=0.5 pts=[[31.75, 13.2], [31.5, 12.75], [31.5, 11.75], [31.75, 11.3]]
track B3_VDDA top w=0.5 pts=[[31.75, 11.3], [32, 11], [32.5, 11], [32.75, 10.75], [32.75, 10.25], [33, 10], [34.5, 10]]
track B3_VDDA bottom w=0.5 pts=[[34.5, 10], [35.5, 9], [35.75, 9], [37.25, 7.5], [37.25, 6.5], [37.5, 6.25]]
track B3_VDDA top w=0.5 pts=[[37.5, 6.25], [37.75, 6.5], [37.75, 7], [38.2, 7.25]]
track +5V top w=0.5 pts=[[6.48, 1.27], [7.25, 2], [7.5, 2.25], [7.5, 3.5], [8, 4], [8, 9], [8.3, 9.25]]
track +5V top w=0.5 pts=[[8.3, 9.25], [8.75, 9.5], [9, 9.75], [9, 10.25], [9.25, 10.5], [9.25, 10.75], [9.8, 11.85]]
track +5V top w=0.5 pts=[[9.8, 11.85], [10.25, 11.25], [15.25, 11.25]]
track +5V top w=0.5
  pts=[[9.8, 11.85], [10.25, 12.75], [10.5, 12.75], [23, 25.25], [23.25, 25.25], [23.5, 25.5], [23.75, 25.5], [28.5, 30.25], [28.75, 30.7]]
track +5V top w=0.5 pts=[[28.75, 30.7], [29, 30.25], [30.25, 30.25], [30.5, 30], [31.05, 29.845]]
track +5V top w=0.5 pts=[[26.25, 28], [26, 28], [18.25, 35.75], [16.5, 35.75], [15.75, 36.5], [15.3, 36.75]]
track B6_A top w=0.25 pts=[[29.25, 16.2], [29.5, 15.75], [29.5, 14.5], [29.3, 14.25]]
track B5_DIV top w=0.25 pts=[[22.25, 14.7], [22.5, 14.75], [24.2, 14.75]]
track B5_DIV top w=0.25 pts=[[22.25, 14.7], [22, 14.5], [20.5, 14.5], [20.25, 14.8]]
track B4_A top w=0.25
  pts=[[31.05, 32.385], [30.5, 32.5], [30.25, 32.5], [29.75, 33], [29.75, 33.5], [29.25, 34], [28.7, 34.75]]
track B3_BOOT0 top w=0.25
  pts=[[36.25, 18], [36.25, 19], [36, 19.25], [34.75, 19.25], [34.75, 21.75], [36, 21.75], [36.25, 22], [36.25, 22.25], [36.5, 22.5], [36.8, 22.75]]
track B3_OSC_OUT top w=0.25 pts=[[34, 14.95], [33.25, 14.75], [32.75, 14.75], [32.75, 14.25]]
track B3_OSC_OUT bottom w=0.25 pts=[[32.75, 14.25], [32.75, 9.25], [33, 9], [33, 8]]
track B3_OSC_OUT top w=0.25 pts=[[33, 8], [33.25, 7.75], [33.25, 7.5], [33.9, 7.05]]
track B3_OSC_OUT top w=0.25 pts=[[33.9, 7.05], [33.25, 6.5], [32, 6.5], [31.75, 6.8]]
track LED_STATUS top w=0.25
  pts=[[29.25, 17.8], [29.5, 18.25], [29.75, 18.5], [29.75, 19.75], [30.75, 20.75], [30.75, 23], [31.25, 23.5], [31.5, 23.5], [31.75, 23.75], [37.5, 23.75], [41, 20.25], [41, 18.75], [41.05, 18]]
track B3_OSC_IN top w=0.25 pts=[[34, 15.75], [33, 15.75], [33, 15.5], [32.75, 15.5]]
track B3_OSC_IN bottom w=0.25
  pts=[[32.75, 15.5], [33.5, 14.75], [33.5, 8.75], [33.75, 8.5], [33.75, 7.75], [35, 6.5], [35, 4.5]]
track B3_OSC_IN top w=0.25 pts=[[35, 4.5], [35.5, 5], [36.1, 5.45]]
track B3_OSC_IN top w=0.25 pts=[[35, 4.5], [35.25, 4.25], [35.25, 3.75], [35.5, 3.5], [35.8, 3.25]]
track AIN0 top w=0.25 pts=[[20.25, 13.2], [20, 13.5], [18.5, 13.5], [18.25, 13.2]]
track AIN0 top w=0.25 pts=[[20.25, 13.2], [20.5, 13.5], [24, 13.5], [24.25, 13.75]]
track AIN0 bottom w=0.25
  pts=[[24.25, 13.75], [26, 15.5], [26.25, 15.5], [26.5, 15.75], [28.25, 15.75], [30, 17.5], [30.25, 17.5], [30.5, 17.75], [31, 17.75], [32, 18.75], [32.25, 18.75], [32.5, 19], [33, 19], [33.25, 18.75], [33.5, 18.75], [33.5, 18.5], [33.75, 18.25], [33.75, 15.5], [34, 15.25], [34, 14], [35.25, 12.75]]
track AIN0 top w=0.25 pts=[[35.25, 12.75], [35, 12.5], [34.75, 12.5], [34, 12.55]]
track B4_B top w=0.25 pts=[[31.05, 31.115], [30.5, 31.25], [29.75, 31.25]]
track B4_B bottom w=0.25 pts=[[29.75, 31.25], [21.5, 31.25]]
track B4_B top w=0.25 pts=[[21.5, 31.25], [20, 31.25], [17.75, 33.5], [17.2, 34.25]]
track SWDIO bottom w=0.25
  pts=[[25.135, 19.21], [25.5, 19.5], [33.5, 19.5], [33.75, 19.25], [34, 19.25], [34.25, 19], [35, 19], [35.25, 18.75], [35.5, 18.75], [37.5, 16.75]]
track SWDIO top w=0.25 pts=[[37.5, 16.75], [40.5, 16.75], [41.5, 15.75], [42.5, 15.75]]
track SWCLK top w=0.25
  pts=[[25.135, 20.48], [25.5, 20.75], [25.75, 20.75], [28.5, 23.5], [30.25, 23.5], [30.75, 24], [31, 24], [31.25, 24.25], [38, 24.25], [41.75, 20.5], [41.75, 16.75], [42.5, 16.55]]
track UART_RX top w=0.25
  pts=[[36.45, 29.845], [37, 29.75], [39.5, 27.25], [39.5, 27], [41.75, 24.75], [41.75, 21.5], [42.25, 21], [42.25, 18.75], [43.75, 17.25], [43.75, 13.5], [43.25, 13.5], [42.5, 13.35]]
track RESET_N top w=0.25 pts=[[34, 14.15], [34.75, 14.25], [35.5, 14.25], [36.25, 15], [37, 15], [37.25, 15.25]]
track RESET_N bottom w=0.25
  pts=[[37.25, 15.25], [38.25, 16.25], [38.25, 17.25], [36, 19.5], [35.5, 19.5], [35.25, 19.75], [34.25, 19.75], [34, 20], [29.5, 20], [29.25, 20.25]]
track RESET_N top w=0.25 pts=[[29.25, 20.25], [29.25, 19], [29, 18.75]]
track RESET_N bottom w=0.25 pts=[[29, 18.75], [30.5, 18.75]]
track RESET_N top w=0.25 pts=[[30.5, 18.75], [31.5, 19.75], [31.75, 20.2]]
track RESET_N bottom w=0.25 pts=[[37.5, 18], [37.5, 18.25], [38.5, 19.25]]
track RESET_N top w=0.25 pts=[[38.5, 19.25], [39, 19.75], [39, 20], [39.3, 20.25]]
track RESET_N bottom w=0.25 pts=[[29.25, 20.25], [26.75, 22.75], [26.75, 23], [25.75, 24], [25.5, 24], [25.135, 24.29]]
track UART_TX top w=0.25
  pts=[[36.45, 33.655], [37, 33.5], [37.25, 33.5], [37.75, 33], [37.75, 32.75], [39.25, 31.25], [39.25, 31], [41.75, 28.5], [41.75, 25.75], [42.25, 25.25], [42.25, 22], [42.75, 21.5], [42.75, 19.25], [44.25, 17.75], [44.25, 13], [44, 13], [43.75, 12.75], [43.25, 12.75], [42.5, 12.55]]
track RS485_DE top w=0.25 pts=[[36.45, 32.385], [37, 32.25], [37, 31.25], [36.45, 31.115]]
track RS485_DE top w=0.25
  pts=[[36.45, 32.385], [35.75, 32.5], [35.25, 33], [35.25, 34], [34.75, 34.5], [34.75, 35.5], [34.3, 35.75]]
track RS485_DE top w=0.25 pts=[[36.45, 31.115], [37, 31], [37.25, 31], [37.75, 30.5]]
track RS485_DE bottom w=0.25
  pts=[[37.75, 30.5], [37.75, 22.5], [38.25, 22], [38.25, 21.75], [38.5, 21.5], [38.5, 20.5], [39.25, 19.75], [39.25, 11.5], [40, 10.75]]
track RS485_DE top w=0.25 pts=[[40, 10.75], [40.25, 10.5], [40.25, 9.5]]
track RS485_B top w=0.25 pts=[[14.3, 34.25], [10.5, 34.25], [10, 33.75], [10, 33.5], [9.7, 33.25]]
track RS485_B top w=0.25 pts=[[10.5, 34.25], [10.25, 34.5], [10.25, 34.75], [10, 35], [9.65, 35.3]]
track RS485_B top w=0.25 pts=[[14.3, 34.25], [13.75, 35], [12.75, 36], [12.75, 39], [12.7, 39.75]]
track RS485_B top w=0.25 pts=[[9.7, 33.25], [9.25, 33.5], [5, 33.5], [4, 34.25]]
track RS485_B bottom w=0.25
  pts=[[4, 34.25], [4.75, 33.25], [4.75, 31.25], [5.5, 30.5], [5.5, 30.25], [5.75, 30], [5.75, 19.5], [6.75, 18.5], [6.75, 18.25], [14.75, 10.25]]
track RS485_B top w=0.25 pts=[[14.75, 10.25], [15.25, 9.75], [15.25, 9.25]]
track RS485_A top w=0.25
  pts=[[25.8, 34.75], [25.25, 35.5], [21.75, 35.5], [21, 36.25], [19, 36.25], [18.75, 36.5], [17.25, 36.5], [16, 37.75], [14.5, 37.75], [14, 37.25], [14, 37], [13.7, 36.75]]
track RS485_A top w=0.25
  pts=[[14.5, 37.75], [14.25, 38], [14.25, 39.25], [13.75, 39.75], [13.75, 41], [11.75, 41], [10, 39.25], [10, 37.5], [9.65, 37.2]]
track RS485_A top w=0.25 pts=[[10.25, 39.5], [10, 39.5], [9.8, 39.75]]
track RS485_A top w=0.25 pts=[[9.8, 39.75], [5.25, 39.75], [4, 39.33]]
track RS485_A top w=0.25 pts=[[25.8, 34.75], [25.25, 34], [25, 33.75], [25, 30.75], [24.75, 30.5]]
track RS485_A bottom w=0.25
  pts=[[24.75, 30.5], [24.75, 26.75], [23, 25], [23, 24.75], [22.75, 24.5], [22.75, 18.5], [23.25, 18], [23.25, 17.75], [23.5, 17.5], [23.5, 13], [23.75, 12.75]]
track RS485_A top w=0.25 pts=[[23.75, 12.75], [24.25, 12.25], [24.25, 11.75]]
via +3V3 at=[8.5, 11.25] d=0.8 drill=0.4
via +3V3 at=[9.75, 18.75] d=0.8 drill=0.4
via +3V3 at=[5.5, 8] d=0.8 drill=0.4
via +3V3 at=[32.75, 16.5] d=0.8 drill=0.4
via +3V3 at=[43.75, 11] d=0.8 drill=0.4
via +3V3 at=[30.75, 16.75] d=0.8 drill=0.4
via +3V3 at=[45, 11.75] d=0.8 drill=0.4
via +3V3 at=[32.75, 21] d=0.8 drill=0.4
via +3V3 at=[40.75, 7.25] d=0.8 drill=0.4
via +3V3 at=[32, 22.75] d=0.8 drill=0.4
via +3V3 at=[22.5, 17.25] d=0.8 drill=0.4
via +3V3 at=[21.25, 11.75] d=0.8 drill=0.4
via GND at=[6.25, 11.25] d=0.8 drill=0.4
via GND at=[6.5, 10.25] d=0.8 drill=0.4
via GND at=[1.75, 9] d=0.8 drill=0.4
via GND at=[41.75, 9.25] d=0.8 drill=0.4
via GND at=[34.75, 18] d=0.8 drill=0.4
via GND at=[36.75, 20.25] d=0.8 drill=0.4
via GND at=[30.75, 15] d=0.8 drill=0.4
via GND at=[32, 8.75] d=0.8 drill=0.4
via GND at=[37.25, 21.25] d=0.8 drill=0.4
via GND at=[34.25, 22.75] d=0.8 drill=0.4
via GND at=[32.75, 18] d=0.8 drill=0.4
via GND at=[45, 8.25] d=0.8 drill=0.4
via GND at=[35.25, 8] d=0.8 drill=0.4
via GND at=[32.75, 5.5] d=0.8 drill=0.4
via GND at=[33.25, 3.25] d=0.8 drill=0.4
via GND at=[32, 4.25] d=0.8 drill=0.4
via GND at=[32.25, 33.75] d=0.8 drill=0.4
via GND at=[27.75, 32.5] d=0.8 drill=0.4
via GND at=[31.75, 35.75] d=0.8 drill=0.4
via GND at=[11, 36.75] d=0.8 drill=0.4
via GND at=[12.25, 33.25] d=0.8 drill=0.4
via GND at=[26.75, 14.75] d=0.8 drill=0.4
via GND at=[18.5, 15.75] d=0.8 drill=0.4
via GND at=[26.75, 13.75] d=0.8 drill=0.4
via GND at=[19.75, 11.25] d=0.8 drill=0.4
via B3_VDDA at=[34.5, 10] d=0.8 drill=0.4
via B3_VDDA at=[37.5, 6.25] d=0.8 drill=0.4
via B3_OSC_OUT at=[32.75, 14.25] d=0.6 drill=0.3
via B3_OSC_OUT at=[33, 8] d=0.6 drill=0.3
via B3_OSC_IN at=[32.75, 15.5] d=0.6 drill=0.3
via B3_OSC_IN at=[35, 4.5] d=0.6 drill=0.3
via AIN0 at=[24.25, 13.75] d=0.6 drill=0.3
via AIN0 at=[35.25, 12.75] d=0.6 drill=0.3
via B4_B at=[29.75, 31.25] d=0.6 drill=0.3
via B4_B at=[21.5, 31.25] d=0.6 drill=0.3
via SWDIO at=[37.5, 16.75] d=0.6 drill=0.3
via RESET_N at=[37.25, 15.25] d=0.6 drill=0.3
via RESET_N at=[29.25, 20.25] d=0.6 drill=0.3
via RESET_N at=[29, 18.75] d=0.6 drill=0.3
via RESET_N at=[30.5, 18.75] d=0.6 drill=0.3
via RESET_N at=[38.5, 19.25] d=0.6 drill=0.3
via RS485_DE at=[37.75, 30.5] d=0.6 drill=0.3
via RS485_DE at=[40, 10.75] d=0.6 drill=0.3
via RS485_B at=[14.75, 10.25] d=0.6 drill=0.3
via RS485_A at=[24.75, 30.5] d=0.6 drill=0.3
via RS485_A at=[23.75, 12.75] d=0.6 drill=0.3

# Comment elle s'assemble — la gamme annotée et la revue
review author=""
  open=["Choisir la référence exacte de l'émetteur-récepteur : son brochage est celui des séries citées, sa fiche fait foi."]
  decisions=[]

# Autres données
fseq
  "" 7
`;
