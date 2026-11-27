/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p, written by tools/gen_demo_bms3.mjs, from its functions to its copper, in the
   .dwiz format. Do not edit by hand : change the generator and run it again. */
export const DEMO_BMS3_1 = `dwiz board/1 BMS-CENTRAL-3X3 "BMS central 3 po × 3 po"
# DynamiteOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description <<<
Le BMS central du module BM 8s8p, 3 po × 3 po au plus, dans le couvercle du bas : vit sur le module ou sur le 12 V du véhicule (le premier présent), interroge les 8 cartes de CORE par la chaîne RS-485 isolée (il en alimente le côté bus), mesure la sortie — courant sur le shunt de la barre de retour, tension du module et de la sortie, température de la borne — et compte l'énergie (EFC), autorise l'énergie (contacteur, précharge, pyrofusible), refroidit (pompe, ventilateur), signale l'état (trois témoins, avertisseur) et parle au véhicule par le CAN FD isolé, qui porte aussi le flux des CORE ; le connecteur d'échange est combiné : ses contacts LV sur la carte, ses contacts HV sur les barres
>>>
revision A
function F1 parent=null kind=principale name="Vivre sur le module ou sur le 12 V, le premier présent" block=null
  criterion name=Sources
    level="le module (8S : 24 à 34 V, prise sur la barre B+) ou le 12 V du véhicule ou de la borne par le connecteur d'échange (9 à 16 V, exemple à confirmer)"
    flex=F1
  criterion name=Réveil level="par le véhicule (WAKE) ou par la borne" flex=F1
function F2 parent=null kind=principale name="Collecter la chaîne RS-485 des 8 cartes de CORE" block=null
  criterion name=Bus level="RS-485 demi-duplex isolé, en chaîne, 9 nœuds" flex=F0
  criterion name="Côté bus" level="alimenté par cette carte, 5 V isolés, 1 W" flex=F0
  criterion name=Terminaison level="120 Ω à cette carte et à la borne + du module" flex=F1
  criterion name=Contenu level="par CORE : sa tension, ses 8 températures ; vers les CORE : l'ordre d'équilibrage"
    flex=F0
function F3 parent=null kind=principale
  name="Mesurer la sortie : courant, tension, température — et compter l'énergie (EFC)" block=null
  criterion name=Courant
    level="shunt de la barre de retour, deux fils Kelvin ; ± 400 A (360 A en décharge, 72 A en charge ; exemple)"
    flex=F1
  criterion name=Tension
    level="du module (prise B+) et de la sortie après le contacteur (prise sur la barre de sortie) : précharge et contacteur soudé"
    flex=F1
  criterion name=Température level="une CTN sur la borne de sortie, par les prises des barres" flex=F1
  criterion name=Énergie level="energy flow counter : tension × courant intégrés par le logiciel" flex=F1
function F4 parent=null kind=principale name="Autoriser l'énergie : contacteur, précharge, pyrofusible" block=null
  criterion name=Contacteur
    level="bobine 12 V, 1 A au plus (enveloppe générique, fiche non lue), contact auxiliaire relu" flex=F1
  criterion name=Précharge level="relais et résistance : le bus du véhicule chargé avant le contacteur" flex=F1
  criterion name=Pyrofusible level="amorce sur le 12 V, en dernier recours" flex=F1
function F5 parent=null kind=principale name="Parler au véhicule et à la borne, en recevoir les ordres" block=null
  criterion name=Liaison level="CAN FD isolé (exemple : 500 kbit/s, 2 Mbit/s en phase de données)" flex=F1
  criterion name=Flux
    level="le flux de la chaîne des 8 CORE (tensions, températures), l'état du module, le courant, l'énergie comptée"
    flex=F0
  criterion name="Ordres câblés"
    level="ENABLE (le véhicule autorise l'énergie), présence (le module est dans sa cavité), acquittement d'un défaut"
    flex=F0
function F6 parent=null kind=principale name="Juger et décider" block=null
  criterion name=Calcul level="microcontrôleur : la machine à états du module, l'équilibrage commandé aux CORE" flex=F1
  criterion name=Mémoire level="réglages, énergie comptée et journal des défauts" flex=F1
function F7 parent=null kind=principale name="Être testable et programmable" block=null
  criterion name=Accès level="connecteur de programmation, points de test" flex=F1
function F8 parent=null kind=principale name="Signaler l'état du module" block=null
  criterion name=Témoins level="vert normal, jaune dératé, rouge urgence ou arrêt (state lamp)" flex=F1
  criterion name=Alarme level="avertisseur piézo" flex=F1
function F9 parent=null kind=principale name="Refroidir : pompe et ventilateur" block=null
  criterion name=Pompe level="12 V, 2 A au plus (exemple)" flex=F1
  criterion name=Ventilateur level="12 V, 1 A au plus (exemple)" flex=F1
function F10 parent=null kind=principale name="Le connecteur d'échange, combiné LV + HV" block=null
  criterion name=HV
    level="les deux contacts de puissance du module sont sur les barres, par des découpes de la carte : aucun courant de puissance dans le cuivre de la carte"
    flex=F0
  criterion name=LV level="contacts de puissance 12 V et contacts de signal soudés sur la carte" flex=F0
  criterion name=Ordre level="le contact de présence s'établit en dernier et rompt en premier" flex=F0
function F11 parent=null kind=contrainte name="Tenir dans le couvercle du bas" block=null
  criterion name=Carte level="76.2 × 76.2 mm au plus (3 po × 3 po)" flex=F0
function F10.1 parent=F10 kind=technique name="Recevoir l'alimentation 12 V, 6 A" block=B1 auto=true
  criteria = []
function F1.1 parent=F1 kind=technique
  name="Protéger l'entrée 12 V contre l'inversion, la surtension et le court-circuit" block=B2 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique name="Recevoir l'alimentation 34 V, 1 A" block=B3 auto=true
  criteria = []
function F1.3 parent=F1 kind=technique
  name="Protéger l'entrée 34 V contre l'inversion, la surtension et le court-circuit" block=B4 auto=true
  criteria = []
function F1.4 parent=F1 kind=technique name="Prendre la plus haute de 34 V et 12 V" block=B5 auto=true
  criteria = []
function F1.5 parent=F1 kind=technique name="Abaisser 34 V vers 5 V, 1 A" block=B6 auto=true
  criteria = []
function F1.6 parent=F1 kind=technique name="Réguler 5 V vers 3,3 V, 0,2 A, sans bruit de découpage" block=B7 auto=true
  criteria = []
function F1.7 parent=F1 kind=technique name="Tenir le microcontrôleur en remise à zéro sous 2,93 V" block=B8 auto=true
  criteria = []
function F1.8 parent=F1 kind=technique name="Lire l'entrée WAKE (12 V)" block=B9 auto=true
  criteria = []
function F3.1 parent=F3 kind=technique name="Mesurer la tension du bus 34 V" block=B10 auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Fournir 5 V isolés à partir de 5 V (1 W)" block=B11 auto=true
  criteria = []
function F2.2 parent=F2 kind=technique name="Isoler une liaison numérique (3 voies aller, 1 retour)" block=B12
  auto=true
  criteria = []
function F2.3 parent=F2 kind=technique name="Communiquer en RS-485 demi-duplex" block=B13 auto=true
  criteria = []
function F2.4 parent=F2 kind=technique name="Raccorder un faisceau : RS485_A,RS485_B,+5V_ISO,GND_ISO" block=B14
  auto=true
  criteria = []
function F3.2 parent=F3 kind=technique name="Raccorder un faisceau : SHUNT_P,SHUNT_N,VOUT_TAP,NTC0,GND" block=B15
  auto=true
  criteria = []
function F3.3 parent=F3 kind=technique name="Mesurer le courant jusqu'à 400 A" block=B16 auto=true
  criteria = []
function F3.4 parent=F3 kind=technique name="Mesurer la tension du bus 34 V" block=B17 auto=true
  criteria = []
function F3.5 parent=F3 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B18 auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Commander la charge CONTACTEUR : 12 V, 1 A" block=B19 auto=true
  criteria = []
function F4.2 parent=F4 kind=technique name="Commander la charge PRECHARGE : 12 V, 0,5 A" block=B20 auto=true
  criteria = []
function F4.3 parent=F4 kind=technique name="Commander la charge PYRO : 12 V, 2 A" block=B21 auto=true
  criteria = []
function F4.4 parent=F4 kind=technique name="Lire l'entrée AUX (12 V)" block=B22 auto=true
  criteria = []
function F9.1 parent=F9 kind=technique name="Commander la charge PUMP : 12 V, 2 A" block=B23 auto=true
  criteria = []
function F9.2 parent=F9 kind=technique name="Commander la charge FAN : 12 V, 1 A" block=B24 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Fournir 5 V isolés à partir de 5 V (1 W)" block=B25 auto=true
  criteria = []
function F5.2 parent=F5 kind=technique name="Isoler une liaison numérique (3 voies aller, 1 retour)" block=B26
  auto=true
  criteria = []
function F5.3 parent=F5 kind=technique name="Communiquer sur le bus CAN" block=B27 auto=true
  criteria = []
function F5.4 parent=F5 kind=technique name="Lire l'entrée ENABLE (12 V)" block=B28 auto=true
  criteria = []
function F5.5 parent=F5 kind=technique name="Lire l'entrée PRES (12 V)" block=B29 auto=true
  criteria = []
function F5.6 parent=F5 kind=technique name="Lire l'entrée ACK (12 V)" block=B30 auto=true
  criteria = []
function F10.2 parent=F10 kind=technique
  name="Raccorder un faisceau : CAN_H,CAN_L,GND_CISO,WAKE_IN,ENABLE_IN,PRES_IN,ACK_IN,GND" block=B31 auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 48 broches" block=B32
  auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Garder les paramètres et l'étalonnage (EEPROM I²C)" block=B33 auto=true
  criteria = []
function F7.1 parent=F7 kind=technique name="Programmer et déboguer le microcontrôleur" block=B34 auto=true
  criteria = []
function F7.2 parent=F7 kind=technique name="Rendre la carte testable et plaçable en machine" block=B35 auto=true
  criteria = []
function F8.1 parent=F8 kind=technique name="Signaler l'état par une DEL verte" block=B36 auto=true
  criteria = []
function F8.2 parent=F8 kind=technique name="Signaler l'état par une DEL jaune" block=B37 auto=true
  criteria = []
function F8.3 parent=F8 kind=technique name="Signaler l'état par une DEL rouge" block=B38 auto=true
  criteria = []
function F8.4 parent=F8 kind=technique name="Avertir par un signal sonore" block=B39 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_power name="Bornier d'alimentation" function=F10.1 zone=[1.5, 19, 8, 19] connect={VIN: +12V_IN, GND: GND}
  params v=12 i=6
block B2 input_protection name="Protection d'entrée" function=F1.1 zone=[10, 19, 20, 19]
  connect={IN: +12V_IN, OUT: +12V, GND: GND}
  params v=12 i=6
block B3 conn_power name="Bornier d'alimentation" function=F1.2 zone=[1.5, 1.5, 8, 17.5]
  connect={VIN: +34V_IN, GND: GND}
  params v=34 i=1
block B4 input_protection name="Protection d'entrée" function=F1.3 zone=[10, 1.5, 28, 13]
  connect={IN: +34V_IN, OUT: +34V, GND: GND}
  params v=34 i=1
block B5 power_or name="Première source présente" function=F1.4 zone=[30, 19, 7.5, 19]
  connect={SRC_A: +34V, SRC_B: +12V, OUT: VSYS, GND: GND}
  params va=34 vb=12 i=0.5
block B6 buck name="Régulateur abaisseur" function=F1.5 zone=[38, 15.5, 14.5, 13.5]
  connect={VIN: VSYS, VOUT: +5V, GND: GND}
  params vin=34 vout=5 iout=1 ripple=30
block B7 ldo name="Régulateur linéaire" function=F1.6 zone=[53, 25, 22, 9] connect={VIN: +5V, VOUT: +3V3, GND: GND}
  params vin=5 vout=3.3 iout=0.2
block B8 supervisor name="Surveillance de l'alimentation" function=F1.7 zone=[60.5, 54.5, 4.5, 6.5]
  connect={VDD: +3V3, GND: GND, RST: RESET_N}
  params vdd=3.3 vth=2.93
block B9 din name="Entrée tout-ou-rien protégée" function=F1.8 zone=[1.5, 57, 8.5, 6]
  connect={IN: WAKE_IN, OUT: DIN0, GND: GND}
  params vin=12 vdd=3.3 name=WAKE
block B10 vbus_sense name="Mesure de la tension du bus" function=F3.1 zone=[10, 14.5, 28, 4]
  connect={VBUS: +34V, GND: GND, OUT: AIN0}
  params vbus=34 vdd=3.3
block B11 dcdc_iso name="Alimentation isolée 1 W" function=F2.1 zone=[38, 1.5, 14, 13.5]
  connect={VIN: +5V, GND: GND, VISO: +5V_ISO, GNDISO: GND_ISO}
  params vin=5 vout=5
block B12 iso_digital name="Isolation de signaux numériques" function=F2.2 zone=[53, 15.5, 22, 9]
  connect={INA: UART_TX, OUTA: ISO_UART_TX, INB: RS485_DE, OUTB: ISO_RS485_DE, IND: ISO_UART_RX, OUTD: UART_RX, VDD1: +3V3, GND1: GND, VDD2: +5V_ISO, GND2: GND_ISO}
  params v1=3.3 v2=5 uart=1
block B13 rs485 name="Interface RS-485" function=F2.3 zone=[53, 8.5, 22, 6.5]
  connect={VCC: +5V_ISO, GND: GND_ISO, DI: ISO_UART_TX, RO: ISO_UART_RX, DE: ISO_RS485_DE, A: RS485_A, B: RS485_B}
  params term=1 bias=1 prot=1 conn=0 nodes=9 iso=1 vdd=5
block B14 conn_wire name="Connecteur fil à carte" function=F2.4 zone=[53, 1.5, 22, 6.5]
  connect={P1: RS485_A, P2: RS485_B, P3: +5V_ISO, P4: GND_ISO}
  params signals="RS485_A,RS485_B,+5V_ISO,GND_ISO" flex=0
block B15 conn_wire name="Connecteur fil à carte" function=F3.2 zone=[65.5, 62.5, 9.5, 12.5]
  connect={P1: SHUNT_P, P2: SHUNT_N, P3: VOUT_TAP, P4: NTC0, P5: GND}
  params signals="SHUNT_P,SHUNT_N,VOUT_TAP,NTC0,GND" flex=0
block B16 shunt name="Mesure de courant par shunt" function=F3.3 zone=[65.5, 54.5, 9.5, 7.5]
  connect={IN: SHUNT_P, LOAD: SHUNT_N, VDD: +3V3, GND: GND, OUT: AIN1}
  params imax=400 vbus=34 vdd=3.3 ext=1 gain=100
block B17 vbus_sense name="Mesure de la tension du bus" function=F3.4 zone=[61, 61.5, 4, 13.5]
  connect={VBUS: VOUT_TAP, GND: GND, OUT: AIN2}
  params vbus=34 vdd=3.3
block B18 ntc name="Mesure de température par CTN" function=F3.5 zone=[56.5, 54.5, 3.5, 6.5]
  connect={VREF: +3V3, GND: GND, OUT: AIN3, NTC: NTC1}
  params vref=3.3 rp=10 fc=10 remote=1
block B19 load_switch name="Commande de charge côté bas" function=F4.1 zone=[1.5, 38.5, 8.5, 8.5]
  connect={VLOAD: +12V, OUT: CONTACTEUR_OUT, IN: DOUT0, GND: GND}
  params v=12 i=1 name=CONTACTEUR
block B20 load_switch name="Commande de charge côté bas" function=F4.2 zone=[10.5, 38.5, 8.5, 8.5]
  connect={VLOAD: +12V, OUT: PRECHARGE_OUT, IN: DOUT1, GND: GND}
  params v=12 i=0.5 name=PRECHARGE
block B21 load_switch name="Commande de charge côté bas" function=F4.3 zone=[1.5, 48, 8.5, 8.5]
  connect={VLOAD: +12V, OUT: PYRO_OUT, IN: DOUT2, GND: GND}
  params v=12 i=2 name=PYRO
block B22 din name="Entrée tout-ou-rien protégée" function=F4.4 zone=[38, 34.5, 5.5, 8]
  connect={IN: AUX_IN, OUT: DIN1, GND: GND}
  params vin=12 vdd=3.3 name=AUX
block B23 load_switch name="Commande de charge côté bas" function=F9.1 zone=[10.5, 48, 8.5, 8.5]
  connect={VLOAD: +12V, OUT: PUMP_OUT, IN: DOUT3, GND: GND}
  params v=12 i=2 name=PUMP
block B24 load_switch name="Commande de charge côté bas" function=F9.2 zone=[19.5, 38.5, 18, 7.5]
  connect={VLOAD: +12V, OUT: FAN_OUT, IN: DOUT4, GND: GND}
  params v=12 i=1 name=FAN
block B25 dcdc_iso name="Alimentation isolée 1 W" function=F5.1 zone=[38, 62.5, 18, 12.5]
  connect={VISO: +5V_CISO, GNDISO: GND_CISO, VIN: +5V, GND: GND}
  params vin=5 vout=5
block B26 iso_digital name="Isolation de signaux numériques" function=F5.2 zone=[19.5, 46.5, 18, 10]
  connect={INA: CAN_TX, OUTA: ISO_CAN_TX, INB: GND, OUTB: ISO_CAN_SPARE, IND: ISO_CAN_RX, OUTD: CAN_RX, VDD2: +5V_CISO, GND2: GND_CISO, VDD1: +3V3, GND1: GND}
  params v1=3.3 v2=5 uart=1
block B27 can name="Interface CAN" function=F5.3 zone=[25.5, 57, 12, 18]
  connect={VCC: +5V_CISO, VIO: +5V_CISO, GND: GND_CISO, TXD: ISO_CAN_TX, RXD: ISO_CAN_RX, CANH: CAN_H, CANL: CAN_L}
  params term=1 choke=1 vio=5
block B28 din name="Entrée tout-ou-rien protégée" function=F5.4 zone=[10.5, 57, 8.5, 6]
  connect={IN: ENABLE_IN, OUT: DIN2, GND: GND}
  params vin=12 vdd=3.3 name=ENABLE
block B29 din name="Entrée tout-ou-rien protégée" function=F5.5 zone=[19.5, 57, 5.5, 8.5]
  connect={IN: PRES_IN, OUT: DIN3, GND: GND}
  params vin=12 vdd=3.3 name=PRES
block B30 din name="Entrée tout-ou-rien protégée" function=F5.6 zone=[19.5, 66.5, 5.5, 8.5]
  connect={IN: ACK_IN, OUT: DIN4, GND: GND}
  params vin=12 vdd=3.3 name=ACK
block B31 conn_wire name="Connecteur fil à carte" function=F10.2 zone=[1.5, 63.5, 18, 11.5]
  connect={P1: CAN_H, P2: CAN_L, P3: GND_CISO, P4: WAKE_IN, P5: ENABLE_IN, P6: PRES_IN, P7: ACK_IN, P8: GND}
  params signals="CAN_H,CAN_L,GND_CISO,WAKE_IN,ENABLE_IN,PRES_IN,ACK_IN,GND" flex=0
block B32 mcu name=Microcontrôleur function=F6.1 zone=[38, 43, 18, 18.5] connect={VDD: +3V3, GND: GND, NRST: RESET_N}
  params pins=48 xtal=8 vdd=3.3
block B33 eeprom name="Mémoire de paramètres" function=F6.2 zone=[56.5, 61.5, 4, 13.5]
  connect={VDD: +3V3, GND: GND, SCL: I2C_SCL, SDA: I2C_SDA}
  params vdd=3.3
block B34 conn_swd name="Connecteur de programmation" function=F7.1 zone=[52, 34.5, 4, 8]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B35 test name="Points de test et mires" function=F7.2 zone=[38, 29, 14.5, 5]
  connect={T1: VSYS, T2: +3V3, T3: GND, T4: GND_ISO, T5: GND_CISO}
  params nets="VSYS,+3V3,GND,GND_ISO,GND_CISO" fiducials=3
block B36 led name="Témoin lumineux" function=F8.1 zone=[44, 34.5, 3.5, 3.5] connect={IN: LED_STATUS, GND: GND}
  params v=3.3 i=2 color=verte
block B37 led name="Témoin lumineux" function=F8.2 zone=[44, 39, 3.5, 3.5] connect={IN: LED_WARN, GND: GND}
  params v=3.3 i=2 color=jaune
block B38 led name="Témoin lumineux" function=F8.3 zone=[48, 34.5, 3.5, 8] connect={IN: LED_FAULT, GND: GND}
  params v=3.3 i=2 color=rouge
block B39 buzzer name="Avertisseur sonore" function=F8.4 zone=[56.5, 34.5, 18.5, 19.5]
  connect={VCC: +5V, IN: DOUT5, GND: GND}
  params v=5

# Avec quoi — les composants, et les nets qui les relient
part J1 J-TB-2-3.5 value="12 V" block=B1 at=[3.5, 28.25] rot=0 side=top local=J role="Entrée d'alimentation" edge=true
part F1 F-1206 value="10 A rapide" block=B2 at=[25.25, 29.25] rot=90 side=top local=F
  role="Coupe en cas de court-circuit"
part Q1 Q-PMOS-DPAK value="" block=B2 at=[30.75, 31.5] rot=270 side=top local=Q
  role="Bloque si la polarité est inversée" near=F1
part R1 R-0603 value="100 kΩ" block=B2 at=[25, 35.75] rot=180 side=top local=RG role="Tire la grille à la masse"
  near=Q1
part D1 D-TVS-SMB value="15 V" block=B2 at=[24, 21.5] rot=0 side=top local=TVS role="Écrête les surtensions"
part C1 CE-D8 value="100 µF 25 V" block=B2 at=[18, 28.5] rot=180 side=top local=CB role="Réservoir d'entrée"
part C2 C-1206 value="1 µF 100 V" block=B2 at=[17.75, 22.25] rot=180 side=top local=C role="Découplage haute fréquence"
  near=C1
part J2 J-TB-2-3.5 value="34 V" block=B3 at=[3.5, 15.25] rot=90 side=top local=J role="Entrée d'alimentation" edge=true
part F2 F-1206 value="1,5 A rapide" block=B4 at=[14.75, 10.75] rot=0 side=top local=F
  role="Coupe en cas de court-circuit"
part Q2 Q-PMOS-DPAK value="" block=B4 at=[32.75, 8.5] rot=90 side=top local=Q role="Bloque si la polarité est inversée"
  near=F2
part R2 R-0603 value="100 kΩ" block=B4 at=[18.25, 5.5] rot=90 side=top local=RG role="Tire la grille à la masse"
  near=Q2
part D2 D-ZEN-SOD123 value="12 V" block=B4 at=[16.75, 2.5] rot=180 side=top local=DZ
  role="Limite la tension grille-source" near=Q2
part D3 D-TVS-SMB value="48 V" block=B4 at=[12, 5.5] rot=90 side=top local=TVS role="Écrête les surtensions"
part C3 CE-D8 value="100 µF 63 V" block=B4 at=[24, 8.5] rot=90 side=top local=CB role="Réservoir d'entrée"
part C4 C-1206 value="1 µF 100 V" block=B4 at=[15.75, 6.75] rot=90 side=top local=C role="Découplage haute fréquence"
  near=C3
part D4 D-SCH-SMA value="60 V 2 A" block=B5 at=[33.5, 20.5] rot=0 side=top local=DA
  role="Laisse passer la source A, bloque le retour vers elle"
part D5 D-SCH-SMA value="60 V 2 A" block=B5 at=[33.5, 24] rot=0 side=top local=DB
  role="Laisse passer la source B, bloque le retour vers elle" near=D4
part C5 C-1206 value="1 µF 100 V" block=B5 at=[36.25, 28.25] rot=90 side=top local=C role="Réservoir du rail commun"
  near=D4
part U1 U-BUCK-SOT23-6 value="" block=B6 at=[42.5, 24.75] rot=180 side=top local=U role="Découpe la tension d'entrée"
part L1 L-4040 value="33 µH" block=B6 at=[43, 20.25] rot=0 side=top local=L role="Lisse le courant" near=U1
part C6 C-1210 value="10 µF 100 V" block=B6 at=[46.5, 25.25] rot=270 side=top local=CIN
  role="Fournit le courant pulsé d'entrée" near=U1
part C7 C-1206 value="100 nF 100 V" block=B6 at=[47.25, 20.25] rot=90 side=top local=CHF
  role="Découplage haute fréquence de l'entrée" near=U1
part C8 C-1206 value="22 µF 10 V" block=B6 at=[50.25, 21.75] rot=90 side=top local=COUT1 role="Filtre la sortie"
  near=L1
part C9 C-1206 value="22 µF 10 V" block=B6 at=[44.75, 15.25] rot=270 side=top local=COUT2 role="Filtre la sortie"
  near=L1
part C10 C-0603 value="100 nF" block=B6 at=[39.25, 23.5] rot=90 side=top local=CBST
  role="Alimente le transistor côté haut" near=U1
part R3 R-0603 value="52,3 kΩ 1 %" block=B6 at=[43, 27.75] rot=0 side=top local=RFB1
  role="Pont de contre-réaction, haut" near=U1
part R4 R-0603 value="10 kΩ 1 %" block=B6 at=[39.25, 27] rot=270 side=top local=RFB2
  role="Pont de contre-réaction, bas" near=U1
part R5 R-0603 value="100 kΩ" block=B6 at=[39.25, 20] rot=90 side=top local=REN
  role="Valide le régulateur dès la mise sous tension" near=U1
part U2 U-LDO-SOT223 value="3,3 V" block=B7 at=[57.5, 28.5] rot=0 side=top local=U role="Régule la tension"
part C11 C-0603 value="1 µF 16 V" block=B7 at=[54.5, 33.25] rot=180 side=top local=CIN role="Stabilise l'entrée"
  near=U2
part C12 C-0805 value="10 µF 16 V" block=B7 at=[63.5, 29.75] rot=90 side=top local=COUT role="Stabilise la sortie"
  near=U2
part U3 U-SUP-SOT23 value="seuil 2,93 V" block=B8 at=[63.25, 56.25] rot=270 side=top local=U
  role="Surveille la tension"
part C13 C-0603 value="100 nF" block=B8 at=[63.5, 59.25] rot=0 side=top local=C role=Découplage near=U3
part R6 R-0805 value="33 kΩ 1 %" block=B9 at=[4, 58.75] rot=90 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R7 R-0603 value="10 kΩ 1 %" block=B9 at=[6.25, 58.5] rot=270 side=top local=R2 role="Bas du pont" near=R6
part D6 D-ZEN-SOD123 value="3,3 V" block=B9 at=[8.5, 59.25] rot=270 side=top local=DZ role="Écrête les surtensions"
  near=R7
part C14 C-0603 value="100 nF" block=B9 at=[5.5, 61.75] rot=180 side=top local=C
  role="Filtre les rebonds et les parasites" near=R7
part R8 R-0805 value="137 kΩ 1 %" block=B10 at=[35, 16.75] rot=270 side=top local=R1 role="Haut du pont diviseur"
part R9 R-0603 value="10 kΩ 1 %" block=B10 at=[32, 15.75] rot=180 side=top local=R2 role="Bas du pont diviseur" near=R8
part C15 C-0603 value="100 nF" block=B10 at=[32, 17.75] rot=180 side=top local=C
  role="Filtre et réservoir du convertisseur" near=R9
part U4 U-DCDC-ISO-SIP4 value="5 V → 5 V" block=B11 at=[45.5, 9.25] rot=0 side=top local=U
  role="Franchit la barrière d'isolement"
part C16 C-0805 value="4,7 µF" block=B11 at=[42.75, 4.5] rot=180 side=top local=CI role="Réserve d'entrée" near=U4
part C17 C-0805 value="4,7 µF" block=B11 at=[48.25, 4.5] rot=180 side=top local=CO role="Lisse la sortie" near=U4
part R10 R-0805 value="240 Ω" block=B11 at=[39.5, 3.75] rot=90 side=top local=RL
  role="Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide" near=C17
part U5 U-ISO-SOIC16W value="" block=B12 at=[57.5, 18.5] rot=270 side=top local=U
  role="Franchit la barrière d'isolement" nc=[OUTC]
part C18 C-0603 value="100 nF" block=B12 at=[64.25, 22.5] rot=270 side=top local=C1 role=Découplage pin="1" near=U5
part C19 C-0603 value="100 nF" block=B12 at=[64.25, 17] rot=90 side=top local=C2 role=Découplage pin="16" near=U5
part U6 U-RS485-SOIC8 value="" block=B13 at=[67.25, 12.25] rot=0 side=top local=U
  role="Traduit l'UART en paire différentielle"
part C20 C-0603 value="100 nF" block=B13 at=[72.25, 12] rot=270 side=top local=C role=Découplage near=U6
part R11 R-0603 value="10 kΩ" block=B13 at=[73, 9.25] rot=0 side=top local=RDE
  role="Tient l'émetteur coupé tant que le microcontrôleur n'a pas démarré" near=U6
part R12 R-1206 value="10 Ω" block=B13 at=[56.75, 10.75] rot=180 side=top local=RSA
  role="Limite le courant d'une surtension sur A (résistance tenant l'impulsion)" near=U6
part R13 R-1206 value="10 Ω" block=B13 at=[65.75, 7.75] rot=180 side=top local=RSB
  role="Limite le courant d'une surtension sur B (résistance tenant l'impulsion)" near=R12
part D7 D-TVS-485-SOT23 value="12 V" block=B13 at=[61.25, 10.25] rot=90 side=top local=D
  role="Écrête les deux lignes, au plus près du bornier"
part R14 R-1206 value="133 Ω 1 %" block=B13 at=[60.75, 6.75] rot=0 side=top local=RT role="Terminaison de ligne"
  near=D7
part R15 R-0603 value="549 Ω 1 %" block=B13 at=[74.25, 12] rot=270 side=top local=RBU
  role="Polarisation : tire A vers l'alimentation" near=D7
part R16 R-0603 value="549 Ω 1 %" block=B13 at=[69.25, 7.5] rot=90 side=top local=RBD
  role="Polarisation : tire B vers la masse" near=R15
part J3 J-WTB-4 value="" block=B14 at=[63.75, 2.25] rot=0 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part J4 J-WTB-5 value="" block=B15 at=[73.95, 68.75] rot=270 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U7 U-CSA-SOT23-5 value="gain 100" block=B16 at=[67.5, 56.75] rot=180 side=top local=U
  role="Amplifie la tension du shunt de la barre"
part C21 C-0603 value="100 nF" block=B16 at=[70.75, 56] rot=90 side=top local=C role=Découplage near=U7
part R17 R-0603 value="10 Ω" block=B16 at=[68.75, 60.5] rot=270 side=top local=RP role="Filtre différentiel d'entrée"
  near=U7
part R18 R-0603 value="10 Ω" block=B16 at=[66.75, 60.5] rot=270 side=top local=RN role="Filtre différentiel d'entrée"
  near=U7
part C22 C-0603 value="100 nF" block=B16 at=[70.75, 59.5] rot=90 side=top local=CD role="Filtre différentiel d'entrée"
  near=U7
part R19 R-0603 value="100 Ω" block=B16 at=[73.5, 55.75] rot=0 side=top local=RF role="Filtre de sortie" near=U7
part C23 C-0603 value="10 nF" block=B16 at=[73.5, 57.75] rot=180 side=top local=CF role="Filtre de sortie" near=R19
part R20 R-0805 value="137 kΩ 1 %" block=B17 at=[63.25, 68.5] rot=180 side=top local=R1 role="Haut du pont diviseur"
part R21 R-0603 value="10 kΩ 1 %" block=B17 at=[62.25, 65.5] rot=270 side=top local=R2 role="Bas du pont diviseur"
  near=R20
part C24 C-0603 value="100 nF" block=B17 at=[64.25, 65.5] rot=270 side=top local=C
  role="Filtre et réservoir du convertisseur" near=R21
part R22 R-0603 value="10 kΩ 1 %" block=B18 at=[58.5, 55.75] rot=180 side=top local=RP role="Haut du pont diviseur"
part R23 R-0603 value="1 kΩ" block=B18 at=[58, 57.75] rot=0 side=top local=RF role="Filtre anti-repliement"
part C25 C-0603 value="15 µF" block=B18 at=[58, 59.75] rot=180 side=top local=CF role="Filtre anti-repliement" near=R23
part Q3 Q-NMOS-SOT23-P value="" block=B19 at=[7.25, 40.25] rot=0 side=top local=Q role="Ferme le circuit de la charge"
part R24 R-0603 value="100 Ω" block=B19 at=[6.25, 44] rot=270 side=top local=RG role="Limite le courant de grille"
  near=Q3
part R25 R-0603 value="100 kΩ" block=B19 at=[8.25, 44] rot=270 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q3
part D8 D-SCH-SMA value="60 V 2 A" block=B19 at=[13, 39.5] rot=180 side=top local=D
  role="Roue libre d'une charge inductive" near=Q3
part Q4 Q-NMOS-SOT23-P value="" block=B20 at=[12.25, 43.75] rot=0 side=top local=Q role="Ferme le circuit de la charge"
part R26 R-0603 value="100 Ω" block=B20 at=[16, 44.75] rot=180 side=top local=RG role="Limite le courant de grille"
  near=Q4
part R27 R-0603 value="100 kΩ" block=B20 at=[16, 42.75] rot=180 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q4
part D9 D-SCH-SMA value="60 V 2 A" block=B20 at=[15, 47.5] rot=180 side=top local=D
  role="Roue libre d'une charge inductive" near=Q4
part Q5 Q-NMOS-SOT23-P value="" block=B21 at=[5.25, 54.75] rot=180 side=top local=Q
  role="Ferme le circuit de la charge"
part R28 R-0603 value="100 Ω" block=B21 at=[8.25, 53] rot=90 side=top local=RG role="Limite le courant de grille"
  near=Q5
part R29 R-0603 value="100 kΩ" block=B21 at=[6.25, 51] rot=90 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q5
part D10 D-SCH-SMA value="60 V 2 A" block=B21 at=[13, 53] rot=180 side=top local=D
  role="Roue libre d'une charge inductive" near=Q5
part R30 R-0805 value="33 kΩ 1 %" block=B22 at=[40.75, 38.5] rot=0 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R31 R-0603 value="10 kΩ 1 %" block=B22 at=[41, 36.25] rot=180 side=top local=R2 role="Bas du pont" near=R30
part D11 D-ZEN-SOD123 value="3,3 V" block=B22 at=[40.75, 41] rot=180 side=top local=DZ role="Écrête les surtensions"
  near=R31
part C26 C-0603 value="100 nF" block=B22 at=[41, 34.25] rot=180 side=top local=C
  role="Filtre les rebonds et les parasites" near=R31
part Q6 Q-NMOS-SOT23-P value="" block=B23 at=[36.25, 39.25] rot=180 side=top local=Q
  role="Ferme le circuit de la charge"
part R32 R-0603 value="100 Ω" block=B23 at=[17.5, 50.25] rot=0 side=top local=RG role="Limite le courant de grille"
  near=Q6
part R33 R-0603 value="100 kΩ" block=B23 at=[18.25, 53] rot=90 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q6
part D12 D-SCH-SMA value="60 V 2 A" block=B23 at=[30.5, 39] rot=0 side=top local=D
  role="Roue libre d'une charge inductive" near=Q6
part Q7 Q-NMOS-SOT23-P value="" block=B24 at=[24.75, 40.25] rot=0 side=top local=Q role="Ferme le circuit de la charge"
part R34 R-0603 value="100 Ω" block=B24 at=[21, 41.25] rot=0 side=top local=RG role="Limite le courant de grille"
  near=Q7
part R35 R-0603 value="100 kΩ" block=B24 at=[21, 39.25] rot=0 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q7
part D13 D-SCH-SMA value="60 V 2 A" block=B24 at=[30.5, 42.5] rot=180 side=top local=D
  role="Roue libre d'une charge inductive" near=Q7
part U8 U-DCDC-ISO-SIP4 value="5 V → 5 V" block=B25 at=[47, 68.25] rot=180 side=top local=U
  role="Franchit la barrière d'isolement"
part C27 C-0805 value="4,7 µF" block=B25 at=[49.75, 63.5] rot=0 side=top local=CI role="Réserve d'entrée" near=U8
part C28 C-0805 value="4,7 µF" block=B25 at=[44.25, 63.5] rot=0 side=top local=CO role="Lisse la sortie" near=U8
part R36 R-0805 value="240 Ω" block=B25 at=[40.25, 63.5] rot=0 side=top local=RL
  role="Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide" near=C28
part U9 U-ISO-SOIC16W value="" block=B26 at=[50, 56.5] rot=180 side=top local=U role="Franchit la barrière d'isolement"
  nc=[OUTC]
part C29 C-0603 value="100 nF" block=B26 at=[36.75, 50] rot=270 side=top local=C1 role=Découplage pin="1" near=U9
part C30 C-0603 value="100 nF" block=B26 at=[36.75, 53.5] rot=90 side=top local=C2 role=Découplage pin="16" near=U9
part U10 U-CAN-SOIC8 value="" block=B27 at=[34.75, 60.75] rot=90 side=top local=U
  role="Traduit les niveaux logiques en niveaux du bus"
part C31 C-0603 value="100 nF" block=B27 at=[34.5, 65.75] rot=180 side=top local=CV role="Découplage 5 V" near=U10
part C32 C-0603 value="100 nF" block=B27 at=[30.75, 61.5] rot=90 side=top local=CIO role="Découplage logique" near=U10
part D14 D-TVS-CAN-SOT23 value="24 V" block=B27 at=[27.25, 72.25] rot=90 side=top local=D
  role="Protège les deux lignes"
part L2 L-CMC-4532 value="51 µH" block=B27 at=[28.75, 65.25] rot=180 side=top local=LC role="Filtre le mode commun"
  near=U10
part R37 R-1206 value="60,4 Ω 1 %" block=B27 at=[27.75, 58.25] rot=0 side=top local=RT1 role=Demi-terminaison
part R38 R-1206 value="60,4 Ω 1 %" block=B27 at=[28.25, 68.75] rot=0 side=top local=RT2 role=Demi-terminaison near=R37
part C33 C-0603 value="4,7 nF" block=B27 at=[28.75, 61.5] rot=90 side=top local=CT
  role="Point milieu de la terminaison" near=R37
part R39 R-0805 value="33 kΩ 1 %" block=B28 at=[11.5, 58.75] rot=90 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R40 R-0603 value="10 kΩ 1 %" block=B28 at=[12, 61.75] rot=0 side=top local=R2 role="Bas du pont" near=R39
part D15 D-ZEN-SOD123 value="3,3 V" block=B28 at=[15, 60.25] rot=90 side=top local=DZ role="Écrête les surtensions"
  near=R40
part C34 C-0603 value="100 nF" block=B28 at=[17.25, 61.5] rot=90 side=top local=C
  role="Filtre les rebonds et les parasites" near=R40
part R41 R-0805 value="33 kΩ 1 %" block=B29 at=[20.5, 58.75] rot=90 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R42 R-0603 value="10 kΩ 1 %" block=B29 at=[20.25, 62.5] rot=90 side=top local=R2 role="Bas du pont" near=R41
part D16 D-ZEN-SOD123 value="3,3 V" block=B29 at=[23, 62.25] rot=90 side=top local=DZ role="Écrête les surtensions"
  near=R42
part C35 C-0603 value="100 nF" block=B29 at=[23.5, 58.75] rot=0 side=top local=C
  role="Filtre les rebonds et les parasites" near=R42
`;
