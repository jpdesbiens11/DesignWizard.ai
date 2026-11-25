/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p, written by tools/gen_demo_bms3.mjs, from its functions to its copper, in the
   .dwiz format. Do not edit by hand : change the generator and run it again. */
export const DEMO_BMS3_1 = `dwiz board/1 BMS-CENTRAL-3X3 "BMS central 3 po × 3 po"
# DynamiteOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description <<<
Le BMS central du module BM 8s8p, 3 po × 3 po au plus, dans le couvercle du bas : vit sur le module ou sur le 12 V du véhicule (le premier présent), interroge les 8 cartes de CORE par la chaîne RS-485 isolée (il en alimente le côté bus), lit le courant du module sur le shunt de la barre de retour, autorise la charge et la décharge, commande le contacteur, sa précharge et le pyrofusible au bout du BM, et parle au véhicule et à la borne par CAN FD isolé.
>>>
revision A
function F1 parent=null kind=principale name="Vivre sur le module ou sur le 12 V, le premier présent" block=null
  criterion name=Sources
    level="le module (8S : 24 à 34 V) ou le 12 V du véhicule ou de la borne (9 à 16 V, exemple à confirmer)" flex=F1
  criterion name=Réveil level="par le véhicule ou la borne (ligne WAKE)" flex=F1
  criterion name=Rails level="5 V, 1 A ; 3,3 V, 200 mA" flex=F1
function F2 parent=null kind=principale name="Collecter la chaîne RS-485 des 8 cartes de CORE" block=null
  criterion name=Bus level="RS-485 demi-duplex isolé, en chaîne, 9 nœuds" flex=F0
  criterion name="Côté bus" level="alimenté par cette carte, 5 V isolés, 1 W" flex=F0
  criterion name=Terminaison level="ici, à un bout de la chaîne" flex=F0
function F3 parent=null kind=principale name="Lire le courant du module sur le shunt de la barre" block=null
  criterion name=Shunt level="pièce de la barre de retour, deux fils Kelvin vers la carte" flex=F1
  criterion name=Plage level="± 400 A (360 A en décharge, 72 A en charge ; exemple)" flex=F1
function F4 parent=null kind=principale name="Autoriser l'énergie : contacteur, précharge, pyrofusible" block=null
  criterion name=Contacteur level="bobine 12 V, 1 A au plus (enveloppe générique, fiche non lue)" flex=F1
  criterion name=Précharge level="relais et résistance : le bus du véhicule chargé avant la fermeture du contacteur"
    flex=F1
  criterion name=Pyrofusible level="amorce commandée par la carte en cas d'urgence, impulsion (exemple, fiche non lue)"
    flex=F1
  criterion name=Relecture level="contact auxiliaire, entrée protégée" flex=F0
function F5 parent=null kind=principale name="Parler au véhicule et à la borne" block=null
  criterion name=Liaison level="CAN FD isolé (exemple : 500 kbit/s, 2 Mbit/s en phase de données)" flex=F1
  criterion name=États level="normal, dératé, urgence, arrêt ; demande de courant" flex=F0
function F6 parent=null kind=principale name="Juger et décider" block=null
  criterion name=Calcul level="microcontrôleur : la machine à états du module, l'équilibrage commandé aux CORE" flex=F1
  criterion name=Mémoire level="réglages et journal des défauts" flex=F1
function F7 parent=null kind=principale name="Être testable et programmable" block=null
  criterion name=Accès level="connecteur de programmation, points de test, témoin" flex=F1
function F8 parent=null kind=contrainte name="Tenir dans le couvercle du bas" block=null
  criterion name=Carte level="76.2 × 76.2 mm au plus (3 po × 3 po)" flex=F0
function F1.1 parent=F1 kind=technique name="Recevoir l'alimentation 12 V, 3 A" block=B1 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique
  name="Protéger l'entrée 12 V contre l'inversion, la surtension et le court-circuit" block=B2 auto=true
  criteria = []
function F1.3 parent=F1 kind=technique name="Recevoir l'alimentation 34 V, 1 A" block=B3 auto=true
  criteria = []
function F1.4 parent=F1 kind=technique
  name="Protéger l'entrée 34 V contre l'inversion, la surtension et le court-circuit" block=B4 auto=true
  criteria = []
function F1.5 parent=F1 kind=technique name="Prendre la plus haute de 34 V et 12 V" block=B5 auto=true
  criteria = []
function F1.6 parent=F1 kind=technique name="Abaisser 34 V vers 5 V, 1 A" block=B6 auto=true
  criteria = []
function F1.7 parent=F1 kind=technique name="Réguler 5 V vers 3,3 V, 0,2 A, sans bruit de découpage" block=B7 auto=true
  criteria = []
function F1.8 parent=F1 kind=technique name="Tenir le microcontrôleur en remise à zéro sous 2,93 V" block=B8 auto=true
  criteria = []
function F1.9 parent=F1 kind=technique name="Lire l'entrée WAKE (12 V)" block=B9 auto=true
  criteria = []
function F1.10 parent=F1 kind=technique name="Mesurer la tension du bus 34 V" block=B10 auto=true
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
function F3.1 parent=F3 kind=technique name="Raccorder un faisceau : SHUNT_P,SHUNT_N" block=B15 auto=true
  criteria = []
function F3.2 parent=F3 kind=technique name="Mesurer le courant jusqu'à 400 A" block=B16 auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Commander la charge CONTACTEUR : 12 V, 1 A" block=B17 auto=true
  criteria = []
function F4.2 parent=F4 kind=technique name="Commander la charge PRECHARGE : 12 V, 0,5 A" block=B18 auto=true
  criteria = []
function F4.3 parent=F4 kind=technique name="Commander la charge PYRO : 12 V, 2 A" block=B19 auto=true
  criteria = []
function F4.4 parent=F4 kind=technique name="Lire l'entrée AUX (12 V)" block=B20 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Fournir 5 V isolés à partir de 5 V (1 W)" block=B21 auto=true
  criteria = []
function F5.2 parent=F5 kind=technique name="Isoler une liaison numérique (3 voies aller, 1 retour)" block=B22
  auto=true
  criteria = []
function F5.3 parent=F5 kind=technique name="Communiquer sur le bus CAN" block=B23 auto=true
  criteria = []
function F5.4 parent=F5 kind=technique name="Raccorder un faisceau : CAN_H,CAN_L,GND_CISO,WAKE_IN" block=B24 auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 48 broches" block=B25
  auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Garder les paramètres et l'étalonnage (EEPROM I²C)" block=B26 auto=true
  criteria = []
function F7.1 parent=F7 kind=technique name="Programmer et déboguer le microcontrôleur" block=B27 auto=true
  criteria = []
function F7.2 parent=F7 kind=technique name="Signaler l'état par une DEL verte" block=B28 auto=true
  criteria = []
function F7.3 parent=F7 kind=technique name="Rendre la carte testable et plaçable en machine" block=B29 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_power name="Bornier d'alimentation" function=F1.1 zone=[1.5, 67, 17.5, 8]
  connect={VIN: +12V_IN, GND: GND}
  params v=12 i=3
block B2 input_protection name="Protection d'entrée" function=F1.2 zone=[1.5, 34.5, 17.5, 32]
  connect={IN: +12V_IN, OUT: +12V, GND: GND}
  params v=12 i=3
block B3 conn_power name="Bornier d'alimentation" function=F1.3 zone=[1.5, 1.5, 8, 19.5]
  connect={VIN: +34V_IN, GND: GND}
  params v=34 i=1
block B4 input_protection name="Protection d'entrée" function=F1.4 zone=[10, 1.5, 28.5, 19.5]
  connect={IN: +34V_IN, OUT: +34V, GND: GND}
  params v=34 i=1
block B5 power_or name="Première source présente" function=F1.5 zone=[1.5, 21.5, 16, 6]
  connect={SRC_A: +34V, SRC_B: +12V, OUT: VSYS, GND: GND}
  params va=34 vb=12 i=0.5
block B6 buck name="Régulateur abaisseur" function=F1.6 zone=[39, 18.5, 18, 13]
  connect={VIN: VSYS, VOUT: +5V, GND: GND}
  params vin=34 vout=5 iout=1 ripple=30
block B7 ldo name="Régulateur linéaire" function=F1.7 zone=[60, 37.5, 15, 8] connect={VIN: +5V, VOUT: +3V3, GND: GND}
  params vin=5 vout=3.3 iout=0.2
block B8 supervisor name="Surveillance de l'alimentation" function=F1.8 zone=[60, 69.5, 7.5, 5.5]
  connect={VDD: +3V3, GND: GND, RST: RESET_N}
  params vdd=3.3 vth=2.93
block B9 din name="Entrée tout-ou-rien protégée" function=F1.9 zone=[19.5, 49.5, 19, 5]
  connect={IN: WAKE_IN, OUT: DIN0, GND: GND}
  params vin=12 vdd=3.3 name=WAKE
block B10 vbus_sense name="Mesure de la tension du bus" function=F1.10 zone=[18, 21.5, 4, 6]
  connect={VBUS: +34V, GND: GND, OUT: AIN0}
  params vbus=34 vdd=3.3
block B11 dcdc_iso name="Alimentation isolée 1 W" function=F2.1 zone=[39, 1.5, 14, 17]
  connect={VIN: +5V, GND: GND, VISO: +5V_ISO, GNDISO: GND_ISO}
  params vin=5 vout=5
block B12 iso_digital name="Isolation de signaux numériques" function=F2.2 zone=[57.5, 18.5, 17.5, 18.5]
  connect={INA: UART_TX, OUTA: ISO_UART_TX, INB: RS485_DE, OUTB: ISO_RS485_DE, IND: ISO_UART_RX, OUTD: UART_RX, VDD1: +3V3, GND1: GND, VDD2: +5V_ISO, GND2: GND_ISO}
  params v1=3.3 v2=5 uart=1
block B13 rs485 name="Interface RS-485" function=F2.3 zone=[53.5, 10, 21.5, 8]
  connect={VCC: +5V_ISO, GND: GND_ISO, DI: ISO_UART_TX, RO: ISO_UART_RX, DE: ISO_RS485_DE, A: RS485_A, B: RS485_B}
  params term=1 bias=1 prot=1 conn=0 nodes=9 iso=1 vdd=5
block B14 conn_wire name="Connecteur fil à carte" function=F2.4 zone=[53.5, 1.5, 21.5, 8]
  connect={P1: RS485_A, P2: RS485_B, P3: +5V_ISO, P4: GND_ISO}
  params signals="RS485_A,RS485_B,+5V_ISO,GND_ISO" flex=0
block B15 conn_wire name="Connecteur fil à carte" function=F3.1 zone=[67.5, 66, 7.5, 9]
  connect={P1: SHUNT_P, P2: SHUNT_N}
  params signals="SHUNT_P,SHUNT_N" flex=0
block B16 shunt name="Mesure de courant par shunt" function=F3.2 zone=[67.5, 54, 7.5, 11.5]
  connect={IN: SHUNT_P, LOAD: SHUNT_N, VDD: +3V3, GND: GND, OUT: AIN1}
  params imax=400 vbus=34 vdd=3.3 ext=1 gain=100
block B17 load_switch name="Commande de charge côté bas" function=F4.1 zone=[1.5, 28, 21, 6]
  connect={VLOAD: +12V, OUT: CONTACTEUR_OUT, IN: DOUT0, GND: GND}
  params v=12 i=1 name=CONTACTEUR
block B18 load_switch name="Commande de charge côté bas" function=F4.2 zone=[22.5, 21.5, 7.5, 13]
  connect={VLOAD: +12V, OUT: PRECHARGE_OUT, IN: DOUT1, GND: GND}
  params v=12 i=0.5 name=PRECHARGE
block B19 load_switch name="Commande de charge côté bas" function=F4.3 zone=[31, 21.5, 7.5, 13]
  connect={VLOAD: +12V, OUT: PYRO_OUT, IN: DOUT2, GND: GND}
  params v=12 i=2 name=PYRO
block B20 din name="Entrée tout-ou-rien protégée" function=F4.4 zone=[39, 37.5, 15, 5]
  connect={IN: AUX_IN, OUT: DIN1, GND: GND}
  params vin=12 vdd=3.3 name=AUX
block B21 dcdc_iso name="Alimentation isolée 1 W" function=F5.1 zone=[39, 62.5, 20.5, 12.5]
  connect={VISO: +5V_CISO, GNDISO: GND_CISO, VIN: +5V, GND: GND}
  params vin=5 vout=5
block B22 iso_digital name="Isolation de signaux numériques" function=F5.2 zone=[19.5, 34.5, 19, 14.5]
  connect={INA: CAN_TX, OUTA: ISO_CAN_TX, INB: GND, OUTB: ISO_CAN_SPARE, IND: ISO_CAN_RX, OUTD: CAN_RX, VDD2: +5V_CISO, GND2: GND_CISO, VDD1: +3V3, GND1: GND}
  params v1=3.3 v2=5 uart=1
block B23 can name="Interface CAN" function=F5.3 zone=[19.5, 55, 19, 9.5]
  connect={VCC: +5V_CISO, VIO: +5V_CISO, GND: GND_CISO, TXD: ISO_CAN_TX, RXD: ISO_CAN_RX, CANH: CAN_H, CANL: CAN_L}
  params term=1 choke=1 vio=5
block B24 conn_wire name="Connecteur fil à carte" function=F5.4 zone=[19.5, 65.5, 19, 9.5]
  connect={P1: CAN_H, P2: CAN_L, P3: GND_CISO, P4: WAKE_IN}
  params signals="CAN_H,CAN_L,GND_CISO,WAKE_IN" flex=0
block B25 mcu name=Microcontrôleur function=F6.1 zone=[39, 43, 20.5, 18.5] connect={VDD: +3V3, GND: GND, NRST: RESET_N}
  params pins=48 xtal=8 vdd=3.3
block B26 eeprom name="Mémoire de paramètres" function=F6.2 zone=[60, 54, 7.5, 15]
  connect={VDD: +3V3, GND: GND, SCL: I2C_SCL, SDA: I2C_SDA}
  params vdd=3.3
block B27 conn_swd name="Connecteur de programmation" function=F7.1 zone=[60, 46, 15, 8]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B28 led name="Témoin lumineux" function=F7.2 zone=[54.5, 37.5, 5, 5] connect={IN: LED_STATUS, GND: GND}
  params v=3.3 i=2 color=verte
block B29 test name="Points de test et mires" function=F7.3 zone=[39, 32.5, 18, 4.5]
  connect={T1: VSYS, T2: +3V3, T3: GND, T4: GND_ISO, T5: GND_CISO}
  params nets="VSYS,+3V3,GND,GND_ISO,GND_CISO" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part J1 J-TB-2-3.5 value="12 V" block=B1 at=[10.25, 72.7] rot=0 side=top local=J role="Entrée d'alimentation" edge=true
part F1 F-1206 value="5 A rapide" block=B2 at=[9.75, 49.75] rot=270 side=top local=F
  role="Coupe en cas de court-circuit"
part Q1 Q-PMOS-DPAK value="" block=B2 at=[10.5, 43.25] rot=180 side=top local=Q
  role="Bloque si la polarité est inversée" near=F1
part R1 R-0603 value="100 kΩ" block=B2 at=[17.25, 42] rot=90 side=top local=RG role="Tire la grille à la masse" near=Q1
part D1 D-TVS-SMB value="15 V" block=B2 at=[4, 51.5] rot=270 side=top local=TVS role="Écrête les surtensions"
part C1 CE-D8 value="100 µF 25 V" block=B2 at=[11, 58] rot=90 side=top local=CB role="Réservoir d'entrée"
part C2 C-1206 value="1 µF 100 V" block=B2 at=[4.75, 57.75] rot=90 side=top local=C role="Découplage haute fréquence"
  near=C1
part J2 J-TB-2-3.5 value="34 V" block=B3 at=[3.5, 17.25] rot=90 side=top local=J role="Entrée d'alimentation" edge=true
part F2 F-1206 value="1,5 A rapide" block=B4 at=[14.75, 7.75] rot=0 side=top local=F
  role="Coupe en cas de court-circuit"
part Q2 Q-PMOS-DPAK value="" block=B4 at=[27.75, 9.5] rot=270 side=top local=Q
  role="Bloque si la polarité est inversée" near=F2
part R2 R-0603 value="100 kΩ" block=B4 at=[29, 16.25] rot=180 side=top local=RG role="Tire la grille à la masse"
  near=Q2
part D2 D-ZEN-SOD123 value="12 V" block=B4 at=[26, 17.75] rot=90 side=top local=DZ
  role="Limite la tension grille-source" near=Q2
part D3 D-TVS-SMB value="48 V" block=B4 at=[19.5, 4] rot=180 side=top local=TVS role="Écrête les surtensions"
part C3 CE-D8 value="100 µF 63 V" block=B4 at=[18, 14] rot=180 side=top local=CB role="Réservoir d'entrée"
part C4 C-1206 value="1 µF 100 V" block=B4 at=[19.75, 7.75] rot=180 side=top local=C role="Découplage haute fréquence"
  near=C3
part D4 D-SCH-SMA value="60 V 2 A" block=B5 at=[14, 23] rot=0 side=top local=DA
  role="Laisse passer la source A, bloque le retour vers elle"
part D5 D-SCH-SMA value="60 V 2 A" block=B5 at=[6.5, 24] rot=180 side=top local=DB
  role="Laisse passer la source B, bloque le retour vers elle" near=D4
part C5 C-1206 value="1 µF 100 V" block=B5 at=[13.25, 26.25] rot=0 side=top local=C role="Réservoir du rail commun"
  near=D4
part U1 U-BUCK-SOT23-6 value="" block=B6 at=[43.5, 22.75] rot=180 side=top local=U role="Découpe la tension d'entrée"
part L1 L-4040 value="33 µH" block=B6 at=[48.5, 23.25] rot=0 side=top local=L role="Lisse le courant" near=U1
part C6 C-1210 value="10 µF 100 V" block=B6 at=[43.25, 26.5] rot=0 side=top local=CIN
  role="Fournit le courant pulsé d'entrée" near=U1
part C7 C-1206 value="100 nF 100 V" block=B6 at=[48.25, 27.25] rot=0 side=top local=CHF
  role="Découplage haute fréquence de l'entrée" near=U1
part C8 C-1206 value="22 µF 10 V" block=B6 at=[53.75, 23.25] rot=0 side=top local=COUT1 role="Filtre la sortie" near=L1
part C9 C-1206 value="22 µF 10 V" block=B6 at=[52.75, 27.25] rot=90 side=top local=COUT2 role="Filtre la sortie"
  near=L1
part C10 C-0603 value="100 nF" block=B6 at=[43.5, 19.75] rot=180 side=top local=CBST
  role="Alimente le transistor côté haut" near=U1
part R3 R-0603 value="52,3 kΩ 1 %" block=B6 at=[47, 19.75] rot=180 side=top local=RFB1
  role="Pont de contre-réaction, haut" near=U1
part R4 R-0603 value="10 kΩ 1 %" block=B6 at=[40.25, 23] rot=270 side=top local=RFB2
  role="Pont de contre-réaction, bas" near=U1
part R5 R-0603 value="100 kΩ" block=B6 at=[39.75, 26.5] rot=90 side=top local=REN
  role="Valide le régulateur dès la mise sous tension" near=U1
part U2 U-LDO-SOT223 value="3,3 V" block=B7 at=[64.5, 41] rot=0 side=top local=U role="Régule la tension"
part C11 C-0603 value="1 µF 16 V" block=B7 at=[70.25, 41] rot=90 side=top local=CIN role="Stabilise l'entrée" near=U2
part C12 C-0805 value="10 µF 16 V" block=B7 at=[71.25, 44] rot=180 side=top local=COUT role="Stabilise la sortie"
  near=U2
part U3 U-SUP-SOT23 value="seuil 2,93 V" block=B8 at=[65.75, 71.25] rot=270 side=top local=U
  role="Surveille la tension"
part C13 C-0603 value="100 nF" block=B8 at=[66, 74.25] rot=0 side=top local=C role=Découplage near=U3
part R6 R-0805 value="33 kΩ 1 %" block=B9 at=[29.5, 52.75] rot=270 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R7 R-0603 value="10 kΩ 1 %" block=B9 at=[26.5, 51.75] rot=180 side=top local=R2 role="Bas du pont" near=R6
part D6 D-ZEN-SOD123 value="3,3 V" block=B9 at=[23.5, 51.75] rot=90 side=top local=DZ role="Écrête les surtensions"
  near=R7
part C14 C-0603 value="100 nF" block=B9 at=[26.5, 53.75] rot=180 side=top local=C
  role="Filtre les rebonds et les parasites" near=R7
part R8 R-0805 value="137 kΩ 1 %" block=B10 at=[19.75, 23.5] rot=0 side=top local=R1 role="Haut du pont diviseur"
part R9 R-0603 value="10 kΩ 1 %" block=B10 at=[19.5, 25.75] rot=180 side=top local=R2 role="Bas du pont diviseur"
  near=R8
part C15 C-0603 value="100 nF" block=B10 at=[19.5, 27.75] rot=180 side=top local=C
  role="Filtre et réservoir du convertisseur" near=R9
part U4 U-DCDC-ISO-SIP4 value="5 V → 5 V" block=B11 at=[49.75, 12] rot=270 side=top local=U
  role="Franchit la barrière d'isolement"
part C16 C-0805 value="4,7 µF" block=B11 at=[45, 14.75] rot=90 side=top local=CI role="Réserve d'entrée" near=U4
part C17 C-0805 value="4,7 µF" block=B11 at=[45, 9.25] rot=90 side=top local=CO role="Lisse la sortie" near=U4
part R10 R-0805 value="240 Ω" block=B11 at=[42.5, 9.25] rot=90 side=top local=RL
  role="Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide" near=C17
part U5 U-ISO-SOIC16W value="" block=B12 at=[65.5, 28] rot=270 side=top local=U role="Franchit la barrière d'isolement"
  nc=[OUTC]
part C18 C-0603 value="100 nF" block=B12 at=[72.25, 32] rot=270 side=top local=C1 role=Découplage pin="1" near=U5
part C19 C-0603 value="100 nF" block=B12 at=[72.25, 24] rot=90 side=top local=C2 role=Découplage pin="16" near=U5
part U6 U-RS485-SOIC8 value="" block=B13 at=[65.25, 14.25] rot=270 side=top local=U
  role="Traduit l'UART en paire différentielle"
part C20 C-0603 value="100 nF" block=B13 at=[69.25, 12] rot=90 side=top local=C role=Découplage near=U6
part R11 R-0603 value="10 kΩ" block=B13 at=[61.25, 15.5] rot=270 side=top local=RDE
  role="Tient l'émetteur coupé tant que le microcontrôleur n'a pas démarré" near=U6
part R12 R-1206 value="10 Ω" block=B13 at=[57.75, 15.25] rot=180 side=top local=RSA
  role="Limite le courant d'une surtension sur A (résistance tenant l'impulsion)" near=U6
part R13 R-1206 value="10 Ω" block=B13 at=[55.75, 11.25] rot=180 side=top local=RSB
  role="Limite le courant d'une surtension sur B (résistance tenant l'impulsion)" near=R12
part D7 D-TVS-485-SOT23 value="12 V" block=B13 at=[60.25, 11.75] rot=90 side=top local=D
  role="Écrête les deux lignes, au plus près du bornier"
part R14 R-1206 value="133 Ω 1 %" block=B13 at=[70.75, 15.25] rot=0 side=top local=RT role="Terminaison de ligne"
  near=D7
part R15 R-0603 value="549 Ω 1 %" block=B13 at=[54.25, 14.5] rot=270 side=top local=RBU
  role="Polarisation : tire A vers l'alimentation" near=D7
part R16 R-0603 value="549 Ω 1 %" block=B13 at=[72, 12.75] rot=180 side=top local=RBD
  role="Polarisation : tire B vers la masse" near=R15
part J3 J-WTB-4 value="" block=B14 at=[64.25, 2.25] rot=0 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part J4 J-WTB-2 value="" block=B15 at=[73.95, 70.25] rot=90 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U7 U-CSA-SOT23-5 value="gain 100" block=B16 at=[69.25, 63.5] rot=90 side=top local=U
  role="Amplifie la tension du shunt de la barre"
part C21 C-0603 value="100 nF" block=B16 at=[69, 60.25] rot=0 side=top local=C role=Découplage near=U7
part R17 R-0603 value="10 Ω" block=B16 at=[72.25, 63.5] rot=270 side=top local=RP role="Filtre différentiel d'entrée"
  near=U7
part R18 R-0603 value="10 Ω" block=B16 at=[74.25, 64] rot=270 side=top local=RN role="Filtre différentiel d'entrée"
  near=U7
part C22 C-0603 value="100 nF" block=B16 at=[73, 60.75] rot=0 side=top local=CD role="Filtre différentiel d'entrée"
  near=U7
part R19 R-0603 value="100 Ω" block=B16 at=[68.25, 57.5] rot=270 side=top local=RF role="Filtre de sortie" near=U7
part C23 C-0603 value="10 nF" block=B16 at=[70.25, 57.5] rot=90 side=top local=CF role="Filtre de sortie" near=R19
part Q3 Q-NMOS-SOT23-P value="" block=B17 at=[12.75, 29.75] rot=90 side=top local=Q
  role="Ferme le circuit de la charge"
part R20 R-0603 value="100 Ω" block=B17 at=[9, 28.75] rot=0 side=top local=RG role="Limite le courant de grille"
  near=Q3
part R21 R-0603 value="100 kΩ" block=B17 at=[15.75, 29.5] rot=270 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q3
part D8 D-SCH-SMA value="60 V 2 A" block=B17 at=[7, 31.5] rot=0 side=top local=D
  role="Roue libre d'une charge inductive" near=Q3
part Q4 Q-NMOS-SOT23-P value="" block=B18 at=[24.25, 28.25] rot=0 side=top local=Q role="Ferme le circuit de la charge"
part R22 R-0603 value="100 Ω" block=B18 at=[23.25, 32] rot=270 side=top local=RG role="Limite le courant de grille"
  near=Q4
part R23 R-0603 value="100 kΩ" block=B18 at=[24, 25.25] rot=180 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q4
part D9 D-SCH-SMA value="60 V 2 A" block=B18 at=[28, 31] rot=270 side=top local=D
  role="Roue libre d'une charge inductive" near=Q4
part Q5 Q-NMOS-SOT23-P value="" block=B19 at=[36.75, 24.75] rot=90 side=top local=Q
  role="Ferme le circuit de la charge"
part R24 R-0603 value="100 Ω" block=B19 at=[33, 23.75] rot=0 side=top local=RG role="Limite le courant de grille"
  near=Q5
part R25 R-0603 value="100 kΩ" block=B19 at=[36.5, 27.75] rot=0 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q5
part D10 D-SCH-SMA value="60 V 2 A" block=B19 at=[33, 28.5] rot=270 side=top local=D
  role="Roue libre d'une charge inductive" near=Q5
part R26 R-0805 value="33 kΩ 1 %" block=B20 at=[46.25, 40] rot=0 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R27 R-0603 value="10 kΩ 1 %" block=B20 at=[49.25, 39] rot=270 side=top local=R2 role="Bas du pont" near=R26
part D11 D-ZEN-SOD123 value="3,3 V" block=B20 at=[51.5, 39.75] rot=270 side=top local=DZ role="Écrête les surtensions"
  near=R27
part C24 C-0603 value="100 nF" block=B20 at=[43.25, 39] rot=270 side=top local=C
  role="Filtre les rebonds et les parasites" near=R27
part U8 U-DCDC-ISO-SIP4 value="5 V → 5 V" block=B21 at=[50.5, 68.25] rot=180 side=top local=U
  role="Franchit la barrière d'isolement"
part C25 C-0805 value="4,7 µF" block=B21 at=[53.25, 63.5] rot=0 side=top local=CI role="Réserve d'entrée" near=U8
part C26 C-0805 value="4,7 µF" block=B21 at=[43, 68.25] rot=90 side=top local=CO role="Lisse la sortie" near=U8
part R28 R-0805 value="240 Ω" block=B21 at=[40.5, 68.25] rot=90 side=top local=RL
  role="Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide" near=C26
part U9 U-ISO-SOIC16W value="" block=B22 at=[33, 43] rot=90 side=top local=U role="Franchit la barrière d'isolement"
  nc=[OUTC]
part C27 C-0603 value="100 nF" block=B22 at=[26.25, 39] rot=90 side=top local=C1 role=Découplage pin="1" near=U9
part C28 C-0603 value="100 nF" block=B22 at=[26.25, 47] rot=270 side=top local=C2 role=Découplage pin="16" near=U9
part U10 U-CAN-SOIC8 value="" block=B23 at=[35.25, 58.75] rot=90 side=top local=U
  role="Traduit les niveaux logiques en niveaux du bus"
part C29 C-0603 value="100 nF" block=B23 at=[35, 63.75] rot=180 side=top local=CV role="Découplage 5 V" near=U10
part C30 C-0603 value="100 nF" block=B23 at=[31.25, 59.5] rot=90 side=top local=CIO role="Découplage logique" near=U10
part D12 D-TVS-CAN-SOT23 value="24 V" block=B23 at=[22.25, 57.25] rot=180 side=top local=D
  role="Protège les deux lignes"
part L2 L-CMC-4532 value="51 µH" block=B23 at=[27.25, 57.25] rot=180 side=top local=LC role="Filtre le mode commun"
  near=U10
part R29 R-1206 value="60,4 Ω 1 %" block=B23 at=[26.75, 61.75] rot=270 side=top local=RT1 role=Demi-terminaison
part R30 R-1206 value="60,4 Ω 1 %" block=B23 at=[22.75, 60.75] rot=0 side=top local=RT2 role=Demi-terminaison near=R29
part C31 C-0603 value="4,7 nF" block=B23 at=[29.25, 61] rot=90 side=top local=CT role="Point milieu de la terminaison"
  near=R29
part J5 J-WTB-4 value="" block=B24 at=[28.75, 73.95] rot=0 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U11 U-MCU-LQFP48 value="" block=B25 at=[47.25, 50.75] rot=180 side=top local=U role="Calcule, mesure et commande"
part C32 C-0603 value="100 nF" block=B25 at=[53.75, 49] rot=90 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U11
part C33 C-0603 value="100 nF" block=B25 at=[45, 57.25] rot=0 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U11
part C34 C-0603 value="100 nF" block=B25 at=[40.75, 48.5] rot=90 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U11
part C35 C-0603 value="100 nF" block=B25 at=[49.5, 44.25] rot=180 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U11
part C36 C-0805 value="4,7 µF" block=B25 at=[54, 45.25] rot=270 side=top local=CB role="Réserve locale" near=U11
part L3 FB-0603 value="600 Ω à 100 MHz" block=B25 at=[55.75, 49] rot=90 side=top local=FB
  role="Isole l'alimentation analogique" near=U11
part C37 C-0603 value="1 µF" block=B25 at=[54.5, 51.75] rot=0 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U11
part C38 C-0603 value="10 nF" block=B25 at=[54.5, 53.75] rot=0 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U11
part R31 R-0603 value="10 kΩ" block=B25 at=[48.5, 57.25] rot=0 side=top local=RR role="Rappel de la remise à zéro"
  near=U11
part C39 C-0603 value="100 nF" block=B25 at=[54.5, 55.75] rot=180 side=top local=CR role="Filtre la remise à zéro"
  near=U11
part R32 R-0603 value="10 kΩ" block=B25 at=[46, 44.25] rot=0 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U11
part Y1 Y-3225 value="8 MHz" block=B25 at=[57.25, 45] rot=90 side=top local=Y role="Base de temps" near=U11
part C40 C-0603 value="15 pF" block=B25 at=[57.75, 49] rot=90 side=top local=CX1 role="Charge du quartz" near=Y1
part C41 C-0603 value="15 pF" block=B25 at=[58, 51.75] rot=180 side=top local=CX2 role="Charge du quartz" near=Y1
part U12 U-EEPROM-SOIC8 value="64 kbit" block=B26 at=[64.25, 59.75] rot=270 side=top local=U
  role="Mémoire non volatile"
part C42 C-0603 value="100 nF" block=B26 at=[65.5, 54.75] rot=180 side=top local=C role=Découplage near=U12
part J6 J-SWD-2x05 value="" block=B27 at=[62, 49.75] rot=270 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part D13 LED-0603 value=verte block=B28 at=[57.75, 41] rot=270 side=top local=D role=Témoin
part R33 R-0603 value="680 Ω" block=B28 at=[55.75, 41] rot=270 side=top local=R role="Fixe le courant" near=D13
part TP1 TP-1.0 value=VSYS block=B29 at=[47.25, 33.25] rot=0 side=top local=TP1 role="Accès de mesure à VSYS"
part TP2 TP-1.0 value=+3V3 block=B29 at=[39.75, 36.25] rot=0 side=top local=TP2 role="Accès de mesure à +3V3"
part TP3 TP-1.0 value=GND block=B29 at=[48.75, 36.25] rot=0 side=top local=TP3 role="Accès de mesure à GND"
part TP4 TP-1.0 value=GND_ISO block=B29 at=[56.25, 33.25] rot=0 side=top local=TP4 role="Accès de mesure à GND_ISO"
part TP5 TP-1.0 value=GND_CISO block=B29 at=[41.75, 36.25] rot=0 side=top local=TP5 role="Accès de mesure à GND_CISO"
part FID1 FID-1.0 value="" block=B29 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B29 at=[73.25, 3] rot=0 side=top local=FID2 role="Repère optique de placement"
  corner=2
part FID3 FID-1.0 value="" block=B29 at=[3, 73.2] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
net +12V_IN class=power voltage=12 current=3 pins=[J1.1, F1.1]
net GND class=ground voltage=0 current=3
  pins=[J1.2, R1.2, D1.A, C1.-, C2.2, J2.2, R2.2, D3.A, C3.-, C4.2, C5.2, U1.GND, C6.2, C7.2, C8.2, C9.2, R4.2, U2.GND, C11.2, C12.2, U3.GND, C13.2, R7.2, D6.A, C14.2, R9.2, C15.2, U4.GND1, C16.2, U5.GND1, C18.2, U5.INC, U7.GND, C21.2, C23.2, Q3.S, R21.2, Q4.S, R23.2, Q5.S, R25.2, R27.2, D11.A, C24.2, U8.GND1, C25.2, U9.GND1, C27.2, U9.INC, U9.INB, U11.VSS, U11.VSSA, C36.2, C37.2, C38.2, C39.2, R32.2, C32.2, C33.2, C34.2, C35.2, Y1.GND, C40.2, C41.2, U12.GND, U12.A0, U12.A1, U12.A2, U12.WP, C42.2, J6.3, J6.5, J6.9, D13.K, TP3.TP]
net B2_FUSED class=power voltage=12 current=3 pins=[F1.2, Q1.D]
net +12V class=power voltage=12 current=3 pins=[Q1.S, D1.K, C1.+, C2.1, D5.A, D8.K, D9.K, D10.K]
net B2_GATE class=signal voltage=12 current=0 pins=[Q1.G, R1.1]
net +34V_IN class=power voltage=34 current=1 pins=[J2.1, F2.1]
net B4_FUSED class=power voltage=34 current=1 pins=[F2.2, Q2.D]
net +34V class=power voltage=34 current=1 pins=[Q2.S, D3.K, C3.+, C4.1, D2.K, D4.A, R8.1]
net B4_GATE class=signal voltage=34 current=0 pins=[Q2.G, R2.1, D2.A]
net VSYS class=power voltage=34 current=0.5 pins=[D4.K, D5.K, C5.1, U1.VIN, C6.1, C7.1, R5.1, TP1.TP]
net B6_SW class=power voltage=34 current=1 pins=[U1.SW, L1.1, C10.2]
net B6_BST class=signal voltage=34 current=0 pins=[U1.BST, C10.1]
net +5V class=power voltage=5 current=1 pins=[L1.2, C8.1, C9.1, R3.1, U2.VIN, C11.1, U4.VIN, C16.1, U8.VIN, C25.1]
net B6_FB class=signal voltage=0 current=0 pins=[U1.FB, R3.2, R4.1]
net B6_EN class=signal voltage=34 current=0 pins=[U1.EN, R5.2]
net +3V3 class=power voltage=3.3 current=0.2
  pins=[U2.VOUT, C12.1, U3.VCC, C13.1, U5.VDD1, U5.EN1, C18.1, U7.VS, C21.1, U9.VDD1, U9.EN1, C27.1, U11.VDD, C32.1, C33.1, C34.1, C35.1, C36.1, L3.1, R31.1, U12.VCC, C42.1, J6.1, TP2.TP]
net RESET_N class=signal voltage=0 current=0 pins=[U3.RESET_N, U11.NRST, R31.2, C39.1, J6.10]
net WAKE_IN class=signal voltage=12 current=0 pins=[R6.1, J5.4]
net DIN0 class=signal voltage=0 current=0 pins=[R6.2, R7.1, D6.K, C14.1, U11.PC13]
net AIN0 class=signal voltage=0 current=0 pins=[R8.2, R9.1, C15.1, U11.PA0]
net +5V_ISO class=power voltage=5 current=0.2
  pins=[U4.VOUT, C17.1, R10.1, U5.VDD2, U5.EN2, C19.1, U6.VCC, C20.1, R15.1, J3.3]
net GND_ISO class=ground voltage=0 current=0
  pins=[U4.GND2, C17.2, R10.2, U5.GND2, C19.2, U6.GND, C20.2, R11.2, D7.GND, R16.2, J3.4, TP4.TP]
net UART_TX class=signal voltage=0 current=0 pins=[U5.INA, U11.PA9]
net ISO_UART_TX class=signal voltage=0 current=0 pins=[U5.OUTA, U6.DI]
net RS485_DE class=signal voltage=0 current=0 pins=[U5.INB, U11.PB1]
net ISO_RS485_DE class=signal voltage=0 current=0 pins=[U5.OUTB, U6.DE, U6.RE_N, R11.1]
net ISO_UART_RX class=signal voltage=0 current=0 pins=[U5.IND, U6.RO]
net UART_RX class=signal voltage=0 current=0 pins=[U5.OUTD, U11.PA10]
net B13_A class=signal voltage=12 current=0 pins=[U6.A, R12.1]
net B13_B class=signal voltage=12 current=0 pins=[U6.B, R13.1]
net RS485_A class=signal voltage=12 current=0 pins=[R12.2, D7.IO1, R14.1, R15.2, J3.1]
net RS485_B class=signal voltage=12 current=0 pins=[R13.2, D7.IO2, R14.2, R16.1, J3.2]
net SHUNT_P class=power voltage=34 current=0.001 pins=[J4.1, R17.1]
net SHUNT_N class=power voltage=34 current=0.001 pins=[J4.2, R18.1]
net B16_SP class=signal voltage=0 current=0 pins=[R17.2, C22.1, U7.IN+]
net B16_SN class=signal voltage=0 current=0 pins=[R18.2, C22.2, U7.IN-]
net B16_AMP class=signal voltage=0 current=0 pins=[U7.OUT, R19.1]
net AIN1 class=signal voltage=0 current=0 pins=[R19.2, C23.1, U11.PA1]
net CONTACTEUR_OUT class=power voltage=12 current=1 pins=[Q3.D, D8.A]
net B17_GATE class=signal voltage=0 current=0 pins=[R20.2, Q3.G, R21.1]
net DOUT0 class=signal voltage=0 current=0 pins=[R20.1, U11.PB3]
net PRECHARGE_OUT class=power voltage=12 current=0.5 pins=[Q4.D, D9.A]
net B18_GATE class=signal voltage=0 current=0 pins=[R22.2, Q4.G, R23.1]
net DOUT1 class=signal voltage=0 current=0 pins=[R22.1, U11.PB4]
net PYRO_OUT class=power voltage=12 current=2 pins=[Q5.D, D10.A]
net B19_GATE class=signal voltage=0 current=0 pins=[R24.2, Q5.G, R25.1]
net DOUT2 class=signal voltage=0 current=0 pins=[R24.1, U11.PB5]
net AUX_IN class=signal voltage=12 current=0 pins=[R26.1]
net DIN1 class=signal voltage=0 current=0 pins=[R26.2, R27.1, D11.K, C24.1, U11.PC14]
net +5V_CISO class=power voltage=5 current=0.2
  pins=[U8.VOUT, C26.1, R28.1, U9.VDD2, U9.EN2, C28.1, U10.VCC, C29.1, U10.VIO, C30.1]
net GND_CISO class=ground voltage=0 current=0
  pins=[U8.GND2, C26.2, R28.2, U9.GND2, C28.2, U10.GND, U10.STB, C29.2, C30.2, D12.GND, C31.2, J5.3, TP5.TP]
net CAN_TX class=signal voltage=0 current=0 pins=[U9.INA, U11.PA12]
net ISO_CAN_TX class=signal voltage=0 current=0 pins=[U9.OUTA, U10.TXD]
net ISO_CAN_SPARE class=signal voltage=0 current=0 pins=[U9.OUTB]
net ISO_CAN_RX class=signal voltage=0 current=0 pins=[U9.IND, U10.RXD]
net CAN_RX class=signal voltage=0 current=0 pins=[U9.OUTD, U11.PA11]
net B23_CANH_IC class=signal voltage=24 current=0 pins=[U10.CANH, L2.1]
net B23_CANL_IC class=signal voltage=24 current=0 pins=[U10.CANL, L2.2]
net CAN_H class=signal voltage=24 current=0 pins=[L2.4, D12.IO1, R29.1, J5.1]
net CAN_L class=signal voltage=24 current=0 pins=[L2.3, D12.IO2, R30.1, J5.2]
net B23_TERM class=signal voltage=0 current=0 pins=[R29.2, R30.2, C31.1]
net B25_VDDA class=power voltage=3.3 current=0.02 pins=[U11.VDDA, L3.2, C37.1, C38.1]
net B25_BOOT0 class=signal voltage=0 current=0 pins=[U11.BOOT0, R32.1]
net B25_OSC_IN class=signal voltage=0 current=0 pins=[U11.OSC_IN, Y1.X1, C40.1]
net B25_OSC_OUT class=signal voltage=0 current=0 pins=[U11.OSC_OUT, Y1.X2, C41.1]
net I2C_SCL class=signal voltage=0 current=0 pins=[U12.SCL, U11.PB6]
net I2C_SDA class=signal voltage=0 current=0 pins=[U12.SDA, U11.PB7]
net SWDIO class=signal voltage=0 current=0 pins=[J6.2, U11.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J6.4, U11.SWCLK]
net LED_STATUS class=signal voltage=3.3 current=0 pins=[R33.1, U11.PA15]
net B28_A class=signal voltage=0 current=0 pins=[R33.2, D13.A]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[76.2, 76.2] r=1 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
planes = []
track VSYS top w=0.5 pts=[[11.9, 23], [12, 23.75], [12, 25.5], [11.8, 26.25]]
track VSYS top w=0.5 pts=[[11.9, 23], [11, 23.25], [9.5, 23.25], [8.6, 24]]
track VSYS top w=0.5 pts=[[11.8, 26.25], [12.25, 25.5], [13, 25.5]]
track VSYS in2 w=0.5 pts=[[13, 25.5], [38.75, 25.5]]
track VSYS top w=0.5 pts=[[38.75, 25.5], [39.5, 25.5], [39.75, 25.7]]
track VSYS top w=0.5 pts=[[39.75, 25.7], [40, 25.25], [41.25, 25.25], [41.8, 26.5]]
track VSYS top w=0.5
  pts=[[41.8, 26.5], [42.25, 27.75], [42.5, 27.75], [43.5, 28.75], [46, 28.75], [46.25, 28.5], [46.25, 28], [46.8, 27.25]]
track VSYS top w=0.5 pts=[[46, 28.75], [46.25, 29], [46.25, 30.25], [47.25, 31.25], [47.25, 33.25]]
track LED_STATUS top w=0.2 pts=[[55.75, 41.8], [55.5, 42.25], [54, 42.25]]
track LED_STATUS in2 w=0.2 pts=[[54, 42.25], [50.5, 42.25], [45, 47.75]]
track LED_STATUS top w=0.2 pts=[[45, 47.75], [45, 46.5]]
track B25_OSC_IN top w=0.25 pts=[[51.5, 50], [50.25, 50], [50.25, 49.25]]
track B25_OSC_IN in2 w=0.25 pts=[[50.25, 49.25], [55.25, 49.25], [57, 47.5]]
track B25_OSC_IN top w=0.25 pts=[[57, 47.5], [57.25, 47.5], [57.5, 47.75], [57.75, 48.2]]
track B25_OSC_IN top w=0.25
  pts=[[57.75, 48.2], [58, 48], [59, 48], [59.25, 47.75], [59.25, 45.25], [59, 45], [57, 45], [57, 44.5], [56.45, 43.9]]
track RESET_N top w=0.25
  pts=[[64.8, 72.35], [64.5, 72], [55.75, 63.25], [55.75, 57.25], [55.5, 57], [55.5, 56], [55.3, 55.75]]
track RESET_N top w=0.2 pts=[[55.3, 55.75], [55, 55.5], [54.75, 55.25], [54.75, 55], [54.5, 54.75], [53, 54.75]]
track RESET_N in1 w=0.2 pts=[[53, 54.75], [53, 54.25], [50, 51.25]]
track RESET_N top w=0.2 pts=[[50, 51.25], [50.25, 51], [51.5, 51]]
track RESET_N top w=0.25 pts=[[53, 54.75], [52, 54.75], [49.75, 57], [49.3, 57.25]]
track RESET_N in1 w=0.25 pts=[[53, 54.25], [59.75, 47.5], [61, 47.5], [61.365, 47.21]]
track AIN0 top w=0.25 pts=[[20.7, 23.5], [20.25, 24], [20.25, 25.5], [20.3, 25.75]]
track AIN0 top w=0.25 pts=[[20.3, 25.75], [20.5, 26], [20.5, 27.5], [20.3, 27.75]]
track AIN0 top w=0.2 pts=[[20.3, 27.75], [20.75, 28], [24, 28], [24.25, 28.25]]
track AIN0 bottom w=0.2 pts=[[24.25, 28.25], [45.75, 49.75]]
track AIN0 top w=0.2 pts=[[45.75, 49.75], [47.25, 49.75], [49.5, 52], [49.75, 52], [50.25, 52.5], [51.5, 52.5]]
track CAN_TX top w=0.2
  pts=[[31.095, 38.35], [31.25, 39.25], [39.75, 47.75], [39.75, 48.5], [41.75, 48.5], [41.75, 49.5], [43, 49.5]]
track GND_CISO top w=0.5
  pts=[[49.23, 68.25], [48.75, 68.75], [48.5, 68.75], [47.75, 69.5], [47.5, 69.5], [47.25, 69.75], [43.75, 69.75], [43.5, 69.5], [43, 69.2]]
track GND_CISO top w=0.5 pts=[[43, 69.2], [42.5, 68.75], [41, 68.75], [40.5, 69.2]]
track GND_CISO top w=0.5
  pts=[[40.5, 69.2], [40, 68.75], [39.75, 68.75], [37.25, 66.25], [36.25, 66.25], [34.75, 64.75], [34.75, 64.5], [34.5, 64.25], [34.5, 64], [34.2, 63.75]]
track GND_CISO top w=0.5 pts=[[34.2, 63.75], [33.75, 63.5], [33.5, 63.25], [33.5, 62], [33.345, 61.45]]
track GND_CISO top w=0.5 pts=[[33.345, 61.45], [33.25, 60.75], [31.5, 60.75], [31.25, 60.3]]
track GND_CISO top w=0.5
  pts=[[31.25, 60.3], [31, 60.75], [30.75, 60.75], [30.25, 61.25], [29.75, 61.25], [29.5, 61.5], [29.25, 61.8]]
track GND_CISO top w=0.5
  pts=[[31.25, 60.3], [31.5, 60], [32, 60], [32.25, 59.75], [32.25, 59.5], [34, 57.75], [34, 57.5], [34.25, 57.25], [34.25, 57], [34.5, 56.75], [34.615, 56.05]]
`;
