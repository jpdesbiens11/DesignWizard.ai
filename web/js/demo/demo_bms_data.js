/* DesignOrbit.ai — the central BMS board of the module BM 8s8p, written by tools/gen_demo_bms.mjs, from its functions to its copper, in the
   .dwiz format. Do not edit by hand : change the generator and run it again. */
export const DEMO_BMS_1 = `dwiz board/1 BMS-CENTRAL-PCBA "BMS central du module"
# DesignOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description <<<
Le BMS central du module BM 8s8p : alimenté par le 12 V du véhicule, il interroge les 8 cartes de CORE par la chaîne RS-485 isolée (il en alimente le côté bus), lit le courant du module sur un capteur posé sur la barre de retour, commande le contacteur et relit son contact auxiliaire, et dit au véhicule l'état du module par CAN : normal, dératé, urgence, arrêt (contacteur ouvert).
>>>
revision A
function F1 parent=null kind=principale name="S'alimenter sur le 12 V du véhicule" block=null
  criterion name=Entrée level="9 à 16 V, le réseau 12 V du véhicule (exemple à confirmer)" flex=F1
  criterion name=Rails level="5 V, 1 A ; 3,3 V, 200 mA" flex=F1
function F2 parent=null kind=principale name="Interroger les 8 cartes de CORE" block=null
  criterion name=Bus level="RS-485 demi-duplex isolé, en chaîne, 9 nœuds" flex=F0
  criterion name="Côté bus" level="alimenté par cette carte, 5 V isolés, 1 W" flex=F0
  criterion name=Terminaison level="ici et au bout de la chaîne (borne + du module)" flex=F0
function F3 parent=null kind=principale name="Lire le courant du module" block=null
  criterion name=Capteur
    level="capteur à effet Hall en boucle fermée sur la barre de retour, hors carte, sortie analogique (exemple)"
    flex=F1
  criterion name=Plage level="± 400 A (exemple à confirmer)" flex=F1
function F4 parent=null kind=principale name="Commander le contacteur" block=null
  criterion name=Bobine level="12 V, 1 A au plus (enveloppe générique, fiche non lue)" flex=F1
  criterion name=Relecture level="contact auxiliaire, entrée protégée" flex=F0
function F5 parent=null kind=principale name="Dire l'état au véhicule" block=null
  criterion name=Liaison level="CAN, 500 kbit/s (exemple)" flex=F1
  criterion name=États level="normal, dératé, urgence, arrêt" flex=F0
function F6 parent=null kind=principale name="Juger et décider" block=null
  criterion name=Calcul level="microcontrôleur, la machine à états du module" flex=F1
  criterion name=Mémoire level="réglages et journal des défauts" flex=F1
function F7 parent=null kind=principale name="Être testable et programmable" block=null
  criterion name=Accès level="connecteur de programmation, points de test, témoin" flex=F1
function F8 parent=null kind=contrainte name="Tenir dans le couvercle du fond" block=null
  criterion name=Carte level="85 × 62 mm (exemple) : le volume réservé à l'itération 11 b, 30 × 48 mm, est trop petit"
    flex=F1
function F1.1 parent=F1 kind=technique name="Recevoir l'alimentation 12 V, 2 A" block=B1 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique
  name="Protéger l'entrée 16 V contre l'inversion, la surtension et le court-circuit" block=B2 auto=true
  criteria = []
function F1.3 parent=F1 kind=technique name="Abaisser 12 V vers 5 V, 1 A" block=B3 auto=true
  criteria = []
function F1.4 parent=F1 kind=technique name="Réguler 5 V vers 3,3 V, 0,2 A, sans bruit de découpage" block=B4 auto=true
  criteria = []
function F1.5 parent=F1 kind=technique name="Tenir le microcontrôleur en remise à zéro sous 2,93 V" block=B5 auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Fournir 5 V isolés à partir de 5 V (1 W)" block=B6 auto=true
  criteria = []
function F2.2 parent=F2 kind=technique name="Isoler une liaison numérique (3 voies aller, 1 retour)" block=B7 auto=true
  criteria = []
function F2.3 parent=F2 kind=technique name="Communiquer en RS-485 demi-duplex" block=B8 auto=true
  criteria = []
function F2.4 parent=F2 kind=technique name="Raccorder un faisceau : RS485_A,RS485_B,+5V_ISO,GND_ISO" block=B9
  auto=true
  criteria = []
function F3.1 parent=F3 kind=technique name="Raccorder un faisceau : +5V,ISENSE,GND" block=B10 auto=true
  criteria = []
function F3.2 parent=F3 kind=technique name="Amplifier le signal ISENSE (gain 1) et le filtrer à 100 Hz" block=B11
  auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Commander la charge CONTACTEUR : 12 V, 1 A" block=B12 auto=true
  criteria = []
function F4.2 parent=F4 kind=technique name="Lire l'entrée AUX (12 V)" block=B13 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Communiquer sur le bus CAN" block=B14 auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 48 broches" block=B15
  auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Garder les paramètres et l'étalonnage (EEPROM I²C)" block=B16 auto=true
  criteria = []
function F7.1 parent=F7 kind=technique name="Programmer et déboguer le microcontrôleur" block=B17 auto=true
  criteria = []
function F7.2 parent=F7 kind=technique name="Signaler l'état par une DEL verte" block=B18 auto=true
  criteria = []
function F7.3 parent=F7 kind=technique name="Rendre la carte testable et plaçable en machine" block=B19 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_power name="Bornier d'alimentation" function=F1.1 zone=[1.5, 1.5, 8.5, 22]
  connect={VIN: +12V_IN, GND: GND}
  params v=12 i=2
block B2 input_protection name="Protection d'entrée" function=F1.2 zone=[1.5, 23.5, 20.5, 27.5]
  connect={IN: +16V_IN, OUT: +16V, GND: GND}
  params v=16 i=2
block B3 buck name="Régulateur abaisseur" function=F1.3 zone=[22.5, 44.5, 21, 16]
  connect={VIN: +12V, VOUT: +5V, GND: GND}
  params vin=12 vout=5 iout=1 ripple=30
block B4 ldo name="Régulateur linéaire" function=F1.4 zone=[10.5, 1.5, 11.5, 22]
  connect={VIN: +5V, VOUT: +3V3, GND: GND}
  params vin=5 vout=3.3 iout=0.2
block B5 supervisor name="Surveillance de l'alimentation" function=F1.5 zone=[22.5, 14.5, 4.5, 11.5]
  connect={VDD: +3V3, GND: GND, RST: RESET_N}
  params vdd=3.3 vth=2.93
block B6 dcdc_iso name="Alimentation isolée 1 W" function=F2.1 zone=[66.5, 40.5, 17, 20]
  connect={VIN: +5V, GND: GND, VISO: +5V_ISO, GNDISO: GND_ISO}
  params vin=5 vout=5
block B7 iso_digital name="Isolation de signaux numériques" function=F2.2 zone=[44, 15, 29.5, 16]
  connect={INA: UART_TX, OUTA: ISO_UART_TX, INB: RS485_DE, OUTB: ISO_RS485_DE, IND: ISO_UART_RX, OUTD: UART_RX, VDD1: +3V3, GND1: GND, VDD2: +5V_ISO, GND2: GND_ISO}
  params v1=3.3 v2=5 uart=1
block B8 rs485 name="Interface RS-485" function=F2.3 zone=[44, 1.5, 26, 13.5]
  connect={VCC: +5V_ISO, GND: GND_ISO, DI: ISO_UART_TX, RO: ISO_UART_RX, DE: ISO_RS485_DE, A: RS485_A, B: RS485_B}
  params term=1 bias=1 prot=1 conn=0 nodes=9 iso=1 vdd=5
block B9 conn_wire name="Connecteur fil à carte" function=F2.4 zone=[70.5, 1.5, 13, 13.5]
  connect={P1: RS485_A, P2: RS485_B, P3: +5V_ISO, P4: GND_ISO}
  params signals="RS485_A,RS485_B,+5V_ISO,GND_ISO" flex=0
block B10 conn_wire name="Connecteur fil à carte" function=F3.1 zone=[1.5, 52, 20.5, 9]
  connect={P1: +5V, P2: ISENSE, P3: GND}
  params signals="+5V,ISENSE,GND" flex=0
block B11 amp name="Amplificateur et filtre" function=F3.2 zone=[27.5, 14.5, 7.5, 11.5]
  connect={IN: ISENSE_IN, OUT: AIN0, VDD: +3V3, GND: GND}
  params gain=1 fc=100 vdd=3.3 name=ISENSE
block B12 load_switch name="Commande de charge côté bas" function=F4.1 zone=[66.5, 31.5, 17, 8.5]
  connect={VLOAD: +12V, OUT: CONTACTEUR_OUT, IN: DOUT0, GND: GND}
  params v=12 i=1 name=CONTACTEUR
block B13 din name="Entrée tout-ou-rien protégée" function=F4.2 zone=[22.5, 5, 9, 9]
  connect={IN: AUX_IN, OUT: DIN0, GND: GND}
  params vin=12 vdd=3.3 name=AUX
block B14 can name="Interface CAN" function=F5.1 zone=[22.5, 26.5, 21, 17.5]
  connect={VCC: +5V, VIO: +3V3, GND: GND, TXD: CAN_TX, RXD: CAN_RX, CANH: CAN_H, CANL: CAN_L}
  params term=1 choke=1 vio=3.3
block B15 mcu name=Microcontrôleur function=F6.1 zone=[44, 31.5, 22, 29] connect={VDD: +3V3, GND: GND, NRST: RESET_N}
  params pins=48 xtal=8 vdd=3.3
block B16 eeprom name="Mémoire de paramètres" function=F6.2 zone=[32, 1.5, 12, 12.5]
  connect={VDD: +3V3, GND: GND, SCL: I2C_SCL, SDA: I2C_SDA}
  params vdd=3.3
block B17 conn_swd name="Connecteur de programmation" function=F7.1 zone=[35.5, 14.5, 8, 11.5]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B18 led name="Témoin lumineux" function=F7.2 zone=[22.5, 1.5, 9, 3.5] connect={IN: LED_STATUS, GND: GND}
  params v=3.3 i=2 color=verte
block B19 test name="Points de test et mires" function=F7.3 zone=[74.5, 15, 9.5, 16]
  connect={T1: +12V, T2: +5V, T3: +3V3, T4: GND, T5: +5V_ISO, T6: GND_ISO, T7: RS485_A, T8: RS485_B}
  params nets="+12V,+5V,+3V3,GND,+5V_ISO,GND_ISO,RS485_A,RS485_B" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part J1 J-TB-2-3.5 value="12 V" block=B1 at=[3.5, 12.25] rot=0 side=top local=J role="Entrée d'alimentation" edge=true
part F1 F-1206 value="3 A rapide" block=B2 at=[11.75, 35.25] rot=0 side=top local=F
  role="Coupe en cas de court-circuit"
part Q1 Q-PMOS-SOT23 value="" block=B2 at=[16.25, 35.25] rot=180 side=top local=Q
  role="Bloque si la polarité est inversée" near=F1
part R1 R-0603 value="100 kΩ" block=B2 at=[19.25, 35] rot=90 side=top local=RG role="Tire la grille à la masse" near=Q1
part D1 D-ZEN-SOD123 value="12 V" block=B2 at=[17.75, 38.5] rot=0 side=top local=DZ
  role="Limite la tension grille-source" near=Q1
part D2 D-TVS-SMB value="24 V" block=B2 at=[18.5, 43.5] rot=90 side=top local=TVS role="Écrête les surtensions"
part C1 CE-D8 value="100 µF 25 V" block=B2 at=[8.5, 42.5] rot=90 side=top local=CB role="Réservoir d'entrée"
part C2 C-1206 value="1 µF 100 V" block=B2 at=[14.75, 42.25] rot=90 side=top local=C role="Découplage haute fréquence"
  near=C1
part U1 U-BUCK-SOT23-6 value="" block=B3 at=[27, 49.25] rot=0 side=top local=U role="Découpe la tension d'entrée"
part L1 L-4040 value="22 µH" block=B3 at=[27.75, 54] rot=90 side=top local=L role="Lisse le courant" near=U1
part C3 C-1210 value="10 µF 25 V" block=B3 at=[31, 48.75] rot=270 side=top local=CIN
  role="Fournit le courant pulsé d'entrée" near=U1
part C4 C-1206 value="100 nF 100 V" block=B3 at=[26.75, 45.75] rot=180 side=top local=CHF
  role="Découplage haute fréquence de l'entrée" near=U1
part C5 C-1206 value="22 µF 10 V" block=B3 at=[26.25, 58.25] rot=180 side=top local=COUT1 role="Filtre la sortie"
  near=L1
part C6 C-1206 value="22 µF 10 V" block=B3 at=[31.25, 58.25] rot=0 side=top local=COUT2 role="Filtre la sortie" near=L1
part C7 C-0603 value="100 nF" block=B3 at=[23.75, 50.5] rot=90 side=top local=CBST
  role="Alimente le transistor côté haut" near=U1
part R2 R-0603 value="52,3 kΩ 1 %" block=B3 at=[23.25, 47] rot=90 side=top local=RFB1
  role="Pont de contre-réaction, haut" near=U1
part R3 R-0603 value="10 kΩ 1 %" block=B3 at=[24.25, 54] rot=90 side=top local=RFB2 role="Pont de contre-réaction, bas"
  near=U1
part R4 R-0603 value="100 kΩ" block=B3 at=[31, 45.25] rot=180 side=top local=REN
  role="Valide le régulateur dès la mise sous tension" near=U1
part U2 U-LDO-SOT223 value="3,3 V" block=B4 at=[15, 20] rot=180 side=top local=U role="Régule la tension"
part C8 C-0603 value="1 µF 16 V" block=B4 at=[20.75, 20] rot=270 side=top local=CIN role="Stabilise l'entrée" near=U2
part C9 C-0805 value="10 µF 16 V" block=B4 at=[21, 16.25] rot=270 side=top local=COUT role="Stabilise la sortie"
  near=U2
part U3 U-SUP-SOT23 value="seuil 2,93 V" block=B5 at=[24.25, 17.25] rot=180 side=top local=U
  role="Surveille la tension"
part C10 C-0603 value="100 nF" block=B5 at=[24, 20.25] rot=0 side=top local=C role=Découplage near=U3
part U4 U-DCDC-ISO-SIP4 value="5 V → 5 V" block=B6 at=[72.25, 49] rot=270 side=top local=U
  role="Franchit la barrière d'isolement"
part C11 C-0805 value="4,7 µF" block=B6 at=[67.5, 51.75] rot=90 side=top local=CI role="Réserve d'entrée" near=U4
part C12 C-0805 value="4,7 µF" block=B6 at=[77, 46.25] rot=90 side=top local=CO role="Lisse la sortie" near=U4
part R5 R-0805 value="240 Ω" block=B6 at=[79.5, 46.25] rot=90 side=top local=RL
  role="Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide" near=C12
part U5 U-ISO-SOIC16W value="" block=B7 at=[52.5, 23] rot=0 side=top local=U role="Franchit la barrière d'isolement"
  nc=[OUTC]
part C13 C-0603 value="100 nF" block=B7 at=[48.5, 29.75] rot=0 side=top local=C1 role=Découplage pin="1" near=U5
part C14 C-0603 value="100 nF" block=B7 at=[56.5, 29.75] rot=180 side=top local=C2 role=Découplage pin="16" near=U5
part U6 U-RS485-SOIC8 value="" block=B8 at=[56.75, 8.75] rot=270 side=top local=U
  role="Traduit l'UART en paire différentielle"
part C15 C-0603 value="100 nF" block=B8 at=[56.5, 3.75] rot=180 side=top local=C role=Découplage near=U6
part R6 R-0603 value="10 kΩ" block=B8 at=[52.75, 8.5] rot=270 side=top local=RDE
  role="Tient l'émetteur coupé tant que le microcontrôleur n'a pas démarré" near=U6
part R7 R-1206 value="10 Ω" block=B8 at=[61.25, 6.75] rot=90 side=top local=RSA
  role="Limite le courant d'une surtension sur A (résistance tenant l'impulsion)" near=U6
part R8 R-1206 value="10 Ω" block=B8 at=[61.25, 2.75] rot=0 side=top local=RSB
  role="Limite le courant d'une surtension sur B (résistance tenant l'impulsion)" near=R7
part D3 D-TVS-485-SOT23 value="12 V" block=B8 at=[65.25, 6.25] rot=180 side=top local=D
  role="Écrête les deux lignes, au plus près du bornier"
part R9 R-1206 value="133 Ω 1 %" block=B8 at=[68.75, 6.25] rot=90 side=top local=RT role="Terminaison de ligne" near=D3
part R10 R-0603 value="549 Ω 1 %" block=B8 at=[64.5, 9.25] rot=0 side=top local=RBU
  role="Polarisation : tire A vers l'alimentation" near=D3
part R11 R-0603 value="549 Ω 1 %" block=B8 at=[65.5, 3.25] rot=0 side=top local=RBD
  role="Polarisation : tire B vers la masse" near=R10
part J2 J-WTB-4 value="" block=B9 at=[82.75, 8.25] rot=90 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part J3 J-WTB-3 value="" block=B10 at=[2.25, 56.25] rot=270 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U7 U-OPAMP-SOT23-5 value="" block=B11 at=[29.25, 19] rot=90 side=top local=U
  role="Amplifie sans charger la source"
part R12 R-0603 value="10 kΩ" block=B11 at=[33, 17.75] rot=180 side=top local=RIN role="Filtre d'entrée" near=U7
part C16 C-0603 value="150 nF" block=B11 at=[29.5, 15.75] rot=180 side=top local=CIN role="Filtre d'entrée" near=U7
part C17 C-0603 value="100 nF" block=B11 at=[29, 22.25] rot=0 side=top local=C role=Découplage near=U7
part Q2 Q-NMOS-SOT23-P value="" block=B12 at=[74.75, 37.75] rot=270 side=top local=Q
  role="Ferme le circuit de la charge"
part R13 R-0603 value="100 Ω" block=B12 at=[78.5, 38.75] rot=180 side=top local=RG role="Limite le courant de grille"
  near=Q2
part R14 R-0603 value="100 kΩ" block=B12 at=[71.75, 38.5] rot=90 side=top local=RPD
  role="Charge coupée tant que le microcontrôleur démarre" near=Q2
part D4 D-SCH-SMA value="60 V 2 A" block=B12 at=[72, 34] rot=0 side=top local=D
  role="Roue libre d'une charge inductive" near=Q2
part R15 R-0805 value="33 kΩ 1 %" block=B13 at=[26.75, 9.5] rot=0 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R16 R-0603 value="10 kΩ 1 %" block=B13 at=[27.75, 12.5] rot=90 side=top local=R2 role="Bas du pont" near=R15
part D5 D-ZEN-SOD123 value="3,3 V" block=B13 at=[30, 11.25] rot=90 side=top local=DZ role="Écrête les surtensions"
  near=R16
part C18 C-0603 value="100 nF" block=B13 at=[25.75, 12.5] rot=90 side=top local=C
  role="Filtre les rebonds et les parasites" near=R16
part U8 U-CAN-SOIC8 value="" block=B14 at=[27.75, 32.75] rot=270 side=top local=U
  role="Traduit les niveaux logiques en niveaux du bus"
part C19 C-0603 value="100 nF" block=B14 at=[27.5, 37.75] rot=0 side=top local=CV role="Découplage 5 V" near=U8
part C20 C-0603 value="100 nF" block=B14 at=[27.5, 27.75] rot=0 side=top local=CIO role="Découplage logique" near=U8
part D6 D-TVS-CAN-SOT23 value="24 V" block=B14 at=[38.75, 30.25] rot=0 side=top local=D role="Protège les deux lignes"
part L2 L-CMC-4532 value="51 µH" block=B14 at=[33.75, 30.25] rot=0 side=top local=LC role="Filtre le mode commun"
  near=U8
part R17 R-1206 value="60,4 Ω 1 %" block=B14 at=[33.25, 35.25] rot=0 side=top local=RT1 role=Demi-terminaison
part R18 R-1206 value="60,4 Ω 1 %" block=B14 at=[37.25, 34.75] rot=90 side=top local=RT2 role=Demi-terminaison near=R17
part C21 C-0603 value="4,7 nF" block=B14 at=[33.5, 37.75] rot=180 side=top local=CT
  role="Point milieu de la terminaison" near=R17
part U9 U-MCU-LQFP48 value="" block=B15 at=[51.75, 39.25] rot=270 side=top local=U role="Calcule, mesure et commande"
part C22 C-0603 value="100 nF" block=B15 at=[53.5, 45.75] rot=180 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U9
part C23 C-0603 value="100 nF" block=B15 at=[45.25, 37] rot=90 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U9
part C24 C-0603 value="100 nF" block=B15 at=[54, 32.75] rot=180 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U9
part C25 C-0603 value="100 nF" block=B15 at=[58.25, 41.5] rot=270 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U9
part C26 C-0805 value="4,7 µF" block=B15 at=[57.25, 46] rot=0 side=top local=CB role="Réserve locale" near=U9
part L3 FB-0603 value="600 Ω à 100 MHz" block=B15 at=[53.5, 47.75] rot=180 side=top local=FB
  role="Isole l'alimentation analogique" near=U9
part C27 C-0603 value="1 µF" block=B15 at=[50.75, 46.5] rot=90 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U9
part C28 C-0603 value="10 nF" block=B15 at=[48.75, 46.5] rot=90 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U9
part R19 R-0603 value="10 kΩ" block=B15 at=[45.25, 40.5] rot=90 side=top local=RR role="Rappel de la remise à zéro"
  near=U9
part C29 C-0603 value="100 nF" block=B15 at=[46.75, 46.5] rot=270 side=top local=CR role="Filtre la remise à zéro"
  near=U9
part R20 R-0603 value="10 kΩ" block=B15 at=[58.25, 38] rot=90 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U9
part Y1 Y-3225 value="8 MHz" block=B15 at=[49.5, 50.25] rot=180 side=top local=Y role="Base de temps" near=U9
part C30 C-0603 value="15 pF" block=B15 at=[52.75, 50.5] rot=90 side=top local=CX1 role="Charge du quartz" near=Y1
part C31 C-0603 value="15 pF" block=B15 at=[46.25, 50] rot=270 side=top local=CX2 role="Charge du quartz" near=Y1
part U10 U-EEPROM-SOIC8 value="64 kbit" block=B16 at=[40.25, 11.25] rot=0 side=top local=U role="Mémoire non volatile"
part C32 C-0603 value="100 nF" block=B16 at=[39.5, 7.25] rot=180 side=top local=C role=Découplage near=U10
part J4 J-SWD-2x05 value="" block=B17 at=[39.75, 24] rot=180 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part D7 LED-0603 value=verte block=B18 at=[27.25, 3.5] rot=270 side=top local=D role=Témoin
part R21 R-0603 value="680 Ω" block=B18 at=[30, 3.25] rot=180 side=top local=R role="Fixe le courant" near=D7
part TP1 TP-1.0 value=+12V block=B19 at=[75.25, 30.25] rot=0 side=top local=TP1 role="Accès de mesure à +12V"
part TP2 TP-1.0 value=+5V block=B19 at=[77.25, 30.25] rot=0 side=top local=TP2 role="Accès de mesure à +5V"
part TP3 TP-1.0 value=+3V3 block=B19 at=[75.25, 28.25] rot=0 side=top local=TP3 role="Accès de mesure à +3V3"
part TP4 TP-1.0 value=GND block=B19 at=[79.25, 30.25] rot=0 side=top local=TP4 role="Accès de mesure à GND"
part TP5 TP-1.0 value=+5V_ISO block=B19 at=[82.25, 15.75] rot=0 side=top local=TP5 role="Accès de mesure à +5V_ISO"
part TP6 TP-1.0 value=GND_ISO block=B19 at=[80.25, 15.75] rot=0 side=top local=TP6 role="Accès de mesure à GND_ISO"
part TP7 TP-1.0 value=RS485_A block=B19 at=[78.25, 15.75] rot=0 side=top local=TP7 role="Accès de mesure à RS485_A"
part TP8 TP-1.0 value=RS485_B block=B19 at=[82.25, 17.75] rot=0 side=top local=TP8 role="Accès de mesure à RS485_B"
part FID1 FID-1.0 value="" block=B19 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B19 at=[77.5, 3] rot=0 side=top local=FID2 role="Repère optique de placement" corner=2
part FID3 FID-1.0 value="" block=B19 at=[7.5, 59] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
net +12V_IN class=power voltage=12 current=2 pins=[J1.1]
net GND class=ground voltage=0 current=2
  pins=[J1.2, R1.2, D2.A, C1.-, C2.2, U1.GND, C3.2, C4.2, C5.2, C6.2, R3.2, U2.GND, C8.2, C9.2, U3.GND, C10.2, U4.GND1, C11.2, U5.GND1, C13.2, U5.INC, J3.3, U7.V-, C17.2, C16.2, Q2.S, R14.2, R16.2, D5.A, C18.2, U8.GND, U8.STB, C19.2, C20.2, D6.GND, C21.2, U9.VSS, U9.VSSA, C26.2, C27.2, C28.2, C29.2, R20.2, C22.2, C23.2, C24.2, C25.2, Y1.GND, C30.2, C31.2, U10.GND, U10.A0, U10.A1, U10.A2, U10.WP, C32.2, J4.3, J4.5, J4.9, D7.K, TP4.TP]
net +16V_IN class=power voltage=16 current=2 pins=[F1.1]
net B2_FUSED class=power voltage=16 current=2 pins=[F1.2, Q1.D]
net +16V class=power voltage=16 current=2 pins=[Q1.S, D2.K, C1.+, C2.1, D1.K]
net B2_GATE class=signal voltage=16 current=0 pins=[Q1.G, R1.1, D1.A]
net +12V class=power voltage=12 current=1 pins=[U1.VIN, C3.1, C4.1, R4.1, D4.K, TP1.TP]
net B3_SW class=power voltage=12 current=1 pins=[U1.SW, L1.1, C7.2]
net B3_BST class=signal voltage=12 current=0 pins=[U1.BST, C7.1]
net +5V class=power voltage=5 current=1
  pins=[L1.2, C5.1, C6.1, R2.1, U2.VIN, C8.1, U4.VIN, C11.1, J3.1, U8.VCC, C19.1, TP2.TP]
net B3_FB class=signal voltage=0 current=0 pins=[U1.FB, R2.2, R3.1]
net B3_EN class=signal voltage=12 current=0 pins=[U1.EN, R4.2]
net +3V3 class=power voltage=3.3 current=0.2
  pins=[U2.VOUT, C9.1, U3.VCC, C10.1, U5.VDD1, U5.EN1, C13.1, U7.V+, C17.1, U8.VIO, C20.1, U9.VDD, C22.1, C23.1, C24.1, C25.1, C26.1, L3.1, R19.1, U10.VCC, C32.1, J4.1, TP3.TP]
net RESET_N class=signal voltage=0 current=0 pins=[U3.RESET_N, U9.NRST, R19.2, C29.1, J4.10]
net +5V_ISO class=power voltage=5 current=0.2
  pins=[U4.VOUT, C12.1, R5.1, U5.VDD2, U5.EN2, C14.1, U6.VCC, C15.1, R10.1, J2.3, TP5.TP]
net GND_ISO class=ground voltage=0 current=0
  pins=[U4.GND2, C12.2, R5.2, U5.GND2, C14.2, U6.GND, C15.2, R6.2, D3.GND, R11.2, J2.4, TP6.TP]
net UART_TX class=signal voltage=0 current=0 pins=[U5.INA, U9.PA9]
net ISO_UART_TX class=signal voltage=0 current=0 pins=[U5.OUTA, U6.DI]
net RS485_DE class=signal voltage=0 current=0 pins=[U5.INB, U9.PB1]
net ISO_RS485_DE class=signal voltage=0 current=0 pins=[U5.OUTB, U6.DE, U6.RE_N, R6.1]
net ISO_UART_RX class=signal voltage=0 current=0 pins=[U5.IND, U6.RO]
net UART_RX class=signal voltage=0 current=0 pins=[U5.OUTD, U9.PA10]
net B8_A class=signal voltage=12 current=0 pins=[U6.A, R7.1]
net B8_B class=signal voltage=12 current=0 pins=[U6.B, R8.1]
net RS485_A class=signal voltage=12 current=0 pins=[R7.2, D3.IO1, R9.1, R10.2, J2.1, TP7.TP]
net RS485_B class=signal voltage=12 current=0 pins=[R8.2, D3.IO2, R9.2, R11.1, J2.2, TP8.TP]
net ISENSE class=signal voltage=0 current=0 pins=[J3.2]
net ISENSE_IN class=signal voltage=0 current=0 pins=[R12.1]
net B11_INP class=signal voltage=0 current=0 pins=[R12.2, C16.1, U7.IN+]
net AIN0 class=signal voltage=0 current=0 pins=[U7.OUT, U7.IN-, U9.PA0]
net CONTACTEUR_OUT class=power voltage=12 current=1 pins=[Q2.D, D4.A]
net B12_GATE class=signal voltage=0 current=0 pins=[R13.2, Q2.G, R14.1]
net DOUT0 class=signal voltage=0 current=0 pins=[R13.1, U9.PB3]
net AUX_IN class=signal voltage=12 current=0 pins=[R15.1]
net DIN0 class=signal voltage=0 current=0 pins=[R15.2, R16.1, D5.K, C18.1, U9.PC13]
net CAN_TX class=signal voltage=0 current=0 pins=[U8.TXD, U9.PA12]
net CAN_RX class=signal voltage=0 current=0 pins=[U8.RXD, U9.PA11]
net B14_CANH_IC class=signal voltage=24 current=0 pins=[U8.CANH, L2.1]
net B14_CANL_IC class=signal voltage=24 current=0 pins=[U8.CANL, L2.2]
net CAN_H class=signal voltage=24 current=0 pins=[L2.4, D6.IO1, R17.1]
net CAN_L class=signal voltage=24 current=0 pins=[L2.3, D6.IO2, R18.1]
net B14_TERM class=signal voltage=0 current=0 pins=[R17.2, R18.2, C21.1]
net B15_VDDA class=power voltage=3.3 current=0.02 pins=[U9.VDDA, L3.2, C27.1, C28.1]
net B15_BOOT0 class=signal voltage=0 current=0 pins=[U9.BOOT0, R20.1]
net B15_OSC_IN class=signal voltage=0 current=0 pins=[U9.OSC_IN, Y1.X1, C30.1]
net B15_OSC_OUT class=signal voltage=0 current=0 pins=[U9.OSC_OUT, Y1.X2, C31.1]
net I2C_SCL class=signal voltage=0 current=0 pins=[U10.SCL, U9.PB6]
net I2C_SDA class=signal voltage=0 current=0 pins=[U10.SDA, U9.PB7]
net SWDIO class=signal voltage=0 current=0 pins=[J4.2, U9.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J4.4, U9.SWCLK]
net LED_STATUS class=signal voltage=3.3 current=0 pins=[R21.1, U9.PA15]
net B18_A class=signal voltage=0 current=0 pins=[R21.2, D7.A]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[85, 62] r=1 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
planes = []
track I2C_SCL top w=0.2 pts=[[42.95, 10.615], [43.5, 10.75], [43.75, 10.75], [44.25, 11.25]]
track I2C_SCL in1 w=0.2 pts=[[44.25, 11.25], [44.25, 28], [54.75, 38.5], [54.75, 39]]
track I2C_SCL top w=0.2 pts=[[54.75, 39], [56, 39]]
track ISO_UART_RX top w=0.25 pts=[[57.15, 21.095], [58, 21], [58.75, 20.25], [58.75, 12], [58.655, 11.45]]
track +5V_ISO top w=0.5 pts=[[72.25, 45.19], [73, 45.25], [76.5, 45.25], [77, 45.3]]
track +5V_ISO top w=0.5 pts=[[77, 45.3], [77.5, 45], [79, 45], [79.5, 45.3]]
track +5V_ISO top w=0.5 pts=[[72.25, 45.19], [72, 44.5], [57.75, 30.25], [57.75, 30], [57.3, 29.75]]
track +5V_ISO top w=0.5 pts=[[57.3, 29.75], [57, 29.5], [57, 27.5], [57.15, 27.445]]
track +5V_ISO top w=0.5
  pts=[[57.15, 27.445], [56.25, 27.25], [56, 27.25], [55.5, 26.75], [55.5, 20.5], [55.75, 20.25], [56, 20.25], [56.25, 20], [57.15, 19.825]]
track +5V_ISO top w=0.5
  pts=[[57.15, 19.825], [56.25, 19.75], [56, 19.75], [55.5, 19.25], [55.5, 18.75], [54.25, 17.5], [54.25, 13], [54, 12.75], [54, 10.25], [54.25, 10], [62.75, 10], [63.25, 9.5], [63.7, 9.25]]
track +5V_ISO top w=0.5 pts=[[58.5, 10], [58.5, 6.75], [58.655, 6.05]]
track +5V_ISO top w=0.5 pts=[[58.655, 6.05], [58.5, 5.5], [58.25, 5.25], [58.25, 4.5], [57.75, 4], [57.3, 3.75]]
track +5V_ISO top w=0.5
  pts=[[63.7, 9.25], [64, 9.5], [64.25, 9.75], [64.25, 10.25], [81.5, 10.25], [82.25, 9.5], [82.75, 9.25]]
track +5V_ISO top w=0.5 pts=[[81.5, 10.25], [81.5, 11.75], [81.75, 12], [81.75, 12.25], [82.25, 12.75], [82.25, 15.75]]
track B2_FUSED top w=0.5 pts=[[13.2, 35.25], [13.75, 35], [14.75, 35], [15.15, 35.25]]
track CONTACTEUR_OUT top w=0.5 pts=[[74.75, 36.65], [74.75, 34.75], [74.1, 34]]
track +16V top w=0.78 pts=[[17.35, 36.2], [17, 36.5], [16.75, 36.75], [16.75, 37.75], [16.5, 38], [16.1, 38.5]]
track +16V top w=0.78 pts=[[16.1, 38.5], [15.75, 39], [15.5, 39.25], [15.5, 40.25], [14.75, 40.8]]
track +16V top w=0.78 pts=[[16.1, 38.5], [16.5, 39], [16.75, 39.25], [16.75, 39.5], [17.5, 40.25], [18.5, 41.35]]
track +16V top w=0.78 pts=[[14.75, 40.8], [14, 40.25], [9.25, 40.25], [8.5, 39.2]]
track +12V top w=0.5 pts=[[28.2, 49.25], [29.25, 49.25], [29.75, 49.75], [31, 50.2]]
track +12V top w=0.5
  pts=[[28.2, 49.25], [27.25, 49.25], [27, 49], [27, 47.75], [27.75, 47], [27.75, 46.5], [28.2, 45.75]]
track +12V top w=0.5
  pts=[[28.2, 45.75], [28.75, 45], [29, 44.75], [29, 44.5], [29.25, 44.25], [31.25, 44.25], [31.5, 44.5], [31.5, 45], [31.8, 45.25]]
track +12V top w=0.5 pts=[[31.8, 45.25], [32.25, 45], [45.5, 45]]
track +12V in2 w=0.5 pts=[[45.5, 45], [48.75, 45], [49.25, 44.5], [59.25, 44.5], [68.5, 35.25]]
track +12V top w=0.5 pts=[[68.5, 35.25], [69, 34.75], [69.9, 34]]
track +12V top w=0.5
  pts=[[69.9, 34], [71, 33.25], [71.25, 33.25], [73.75, 30.75], [74, 30.75], [74.25, 30.5], [74.5, 30.5], [74.75, 30.25], [75.25, 30.25]]
track +5V top w=0.5 pts=[[27.75, 55.5], [28.25, 56], [28.25, 57.5], [27.7, 58.25]]
track +5V top w=0.5 pts=[[27.7, 58.25], [28.25, 57.75], [29.25, 57.75], [29.8, 58.25]]
track +5V top w=0.5
  pts=[[27.75, 55.5], [26.25, 56], [26, 56.25], [26, 56.5], [22.5, 56.5], [22.5, 49], [22.25, 48.75], [22.25, 46.75], [22.75, 46.75], [23, 46.5], [23.25, 46.2]]
track +5V top w=0.5
  pts=[[23.25, 46.2], [23.5, 45.75], [23.75, 45.5], [23.75, 44.25], [24.75, 43.25], [24.75, 41.75], [26.25, 40.25], [26.25, 38], [26.7, 37.75]]
track +5V top w=0.5 pts=[[26.7, 37.75], [27, 37.5], [27, 36], [27.115, 35.45]]
track +5V top w=0.5
  pts=[[27.115, 35.45], [27, 34.75], [26.75, 34.5], [26.75, 34.25], [19.25, 26.75], [19.25, 22.75], [18.15, 22.3]]
track +5V top w=0.5 pts=[[18.15, 22.3], [19.25, 21.75], [20, 21.75], [20.5, 21.25], [20.75, 20.8]]
track +5V top w=0.5 pts=[[22.5, 56.5], [4, 56.5], [2.25, 58.25]]
track +5V top w=0.5 pts=[[27.75, 55.5], [29.25, 55], [63, 55], [66.5, 51.5], [66.75, 51.5], [67, 51.25], [67.5, 50.8]]
track +5V top w=0.5 pts=[[67.5, 50.8], [68, 50.5], [71.5, 50.5], [72.25, 50.27]]
track +5V in1 w=0.5
  pts=[[72.25, 50.27], [72.75, 49.75], [72.75, 49.5], [73.5, 48.75], [73.5, 48.5], [73.75, 48.25], [73.75, 34.25], [76.75, 31.25]]
track +5V top w=0.5 pts=[[76.75, 31.25], [77.25, 30.75], [77.25, 30.25]]
track B18_A top w=0.25 pts=[[29.2, 3.25], [28.75, 3], [27.5, 3], [27.25, 2.7]]
track B3_BST top w=0.25 pts=[[25.8, 50.2], [25.5, 50.5], [25.5, 51]]
`;
