/* DynamiteOrbit.ai — the demonstration board, written by tools/gen_demo_pcba.mjs : the control board of the compact drive,
   from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */

export const DEMO_PCBA_DESIGN = `dwiz board/1 DRV-CTRL-PCBA "Carte de contrôle du variateur"
# DynamiteOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description "Reçoit le 24 V, alimente la logique, calcule et pilote l'étage de puissance, mesure la température et le mouvement, communique en CAN."
revision A
function F1 parent=null kind=principale name="Alimenter la logique à partir du 24 V" block=null
  criterion name="Tension d'entrée" level="18 à 30 V" flex=F0
  criterion name=Rails level="5 V 1 A ; 3,3 V 0,3 A" flex=F1
function F2 parent=null kind=principale name="Calculer et piloter l'étage de puissance" block=null
  criterion name="Fréquence de découpage" level="20 kHz" flex=F1
function F3 parent=null kind=principale name="Communiquer avec le système" block=null
  criterion name=Bus level="CAN 500 kbit/s, terminaison commutable" flex=F1
function F4 parent=null kind=principale name="Mesurer la température et le mouvement" block=null
  criterion name=Température level="−20 à 100 °C, ± 2 K" flex=F1
function F5 parent=null kind=principale name="Signaler l'état" block=null
  criterion name=Témoin level="visible capot fermé" flex=F2
function F6 parent=null kind=principale name="Être testable, programmable et fabricable en prototype rapide" block=null
  criterion name=Délai level="carte montée en 10 jours ouvrables" flex=F1
function F7 parent=null kind=contrainte name="Tenir dans le boîtier" block=null
  criterion name=Carte level="60 × 90 mm, 4 vis M3, composants ≤ 9 mm" flex=F0
function F8 parent=null kind=contrainte name="Résister à l'environnement" block=null
  criterion name=Vernis level="acrylique 50 µm, deux faces" flex=F1
function F3.1 parent=F3 kind=technique name="Raccorder la carte : +24V_IN,GND,CAN_H,CAN_L" block=B1 auto=true
  criteria = []
function F1.1 parent=F1 kind=technique
  name="Protéger l'entrée 24 V contre l'inversion, la surtension et le court-circuit" block=B2 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique name="Abaisser 24 V vers 5 V, 1 A" block=B3 auto=true
  criteria = []
function F1.3 parent=F1 kind=technique name="Réguler 5 V vers 3,3 V, 0,3 A, sans bruit de découpage" block=B4 auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 48 broches" block=B5
  auto=true
  criteria = []
function F2.2 parent=F2 kind=technique name="Relier la carte voisine : +5V,GND,PWM_H,PWM_L,AIN1,AIN2,DOUT0,GND"
  block=B6 auto=true
  criteria = []
function F3.2 parent=F3 kind=technique name="Communiquer sur le bus CAN" block=B7 auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 100 Hz" block=B8 auto=true
  criteria = []
function F4.2 parent=F4 kind=technique name="Mesurer l'accélération et la rotation (6 axes, I²C)" block=B9 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Signaler l'état par une DEL verte" block=B10 auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Programmer et déboguer le microcontrôleur" block=B11 auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Rendre la carte testable et plaçable en machine" block=B12 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_io name="Connecteur d'entrées-sorties" function=F3.1 zone=[1.5, 1.5, 11, 42]
  connect={P1: +24V_IN, P2: GND, P3: CAN_H, P4: CAN_L}
  params signals="+24V_IN,GND,CAN_H,CAN_L"
block B2 input_protection name="Protection d'entrée" function=F1.1 zone=[13, 1.5, 15, 42]
  connect={IN: +24V_IN, OUT: +24V, GND: GND}
  params v=24 i=1
block B3 buck name="Régulateur abaisseur" function=F1.2 zone=[1.5, 61.5, 27, 20]
  connect={VIN: +24V, VOUT: +5V, GND: GND}
  params vin=24 vout=5 iout=1 ripple=30
block B4 ldo name="Régulateur linéaire" function=F1.3 zone=[28.5, 1.5, 14, 28] connect={VIN: +5V, VOUT: +3V3, GND: GND}
  params vin=5 vout=3.3 iout=0.3
block B5 mcu name=Microcontrôleur function=F2.1 zone=[28.5, 29.5, 30, 32] connect={VDD: +3V3, GND: GND, NRST: RESET_N}
  params pins=48 xtal=8 vdd=3.3
block B6 conn_board name="Liaison carte à carte" function=F2.2 zone=[28.5, 62.5, 30, 26.5]
  connect={P1: +5V, P2: GND, P3: PWM_H, P4: PWM_L, P5: AIN1, P6: AIN2, P7: DOUT0, P8: GND}
  params signals="+5V,GND,PWM_H,PWM_L,AIN1,AIN2,DOUT0,GND"
block B7 can name="Interface CAN" function=F3.2 zone=[1.5, 44, 27, 17]
  connect={VCC: +5V, VIO: +3V3, GND: GND, TXD: CAN_TX, RXD: CAN_RX, CANH: CAN_H, CANL: CAN_L}
  params term=1 choke=0 vio=3.3
block B8 ntc name="Mesure de température par CTN" function=F4.1 zone=[43, 1.5, 6, 15]
  connect={VREF: +3V3, GND: GND, OUT: AIN0}
  params vref=3.3 rp=10 fc=100
block B9 imu name="Centrale inertielle" function=F4.2 zone=[49, 1.5, 9.5, 15]
  connect={VDD: +3V3, GND: GND, SCL: I2C_SCL, SDA: I2C_SDA, INT1: IMU_INT}
  params vdd=3.3 pull=1
block B10 led name="Témoin lumineux" function=F5.1 zone=[55.5, 17, 3.5, 12.5] connect={IN: LED_STATUS, GND: GND}
  params v=3.3 i=2 color=verte
block B11 conn_swd name="Connecteur de programmation" function=F6.1 zone=[43, 17, 12, 12.5]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B12 test name="Points de test et mires" function=F6.2 zone=[1.5, 82, 27, 7]
  connect={T1: +24V, T2: +5V, T3: +3V3, T4: GND}
  params nets="+24V,+5V,+3V3,GND" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part J1 J-HDR-1x04 value="" block=B1 at=[1.27, 22.25] rot=90 side=top local=J
  role="Liaison vers l'extérieur de la carte" edge=true nc=[]
part F1 F-1206 value="1,5 A rapide" block=B2 at=[17.75, 15.75] rot=0 side=top local=F
  role="Coupe en cas de court-circuit"
part Q1 Q-PMOS-SOT23 value="" block=B2 at=[22.25, 15.25] rot=180 side=top local=Q
  role="Bloque si la polarité est inversée" near=F1
part R1 R-0603 value="100 kΩ" block=B2 at=[25.25, 15] rot=90 side=top local=RG role="Tire la grille à la masse" near=Q1
part D1 D-ZEN-SOD123 value="12 V" block=B2 at=[23.75, 12] rot=180 side=top local=DZ
  role="Limite la tension grille-source" near=Q1
part D2 D-TVS-SMB value="28 V" block=B2 at=[23.5, 8.5] rot=180 side=top local=TVS role="Écrête les surtensions"
part C1 CE-D8 value="100 µF 50 V" block=B2 at=[20, 23] rot=90 side=top local=CB role="Réservoir d'entrée"
part C2 C-1206 value="1 µF 100 V" block=B2 at=[26.25, 22.75] rot=90 side=top local=C role="Découplage haute fréquence"
  near=C1
part U1 U-BUCK-SOT23-6 value="" block=B3 at=[16.75, 66] rot=270 side=top local=U role="Découpe la tension d'entrée"
part L1 L-4040 value="33 µH" block=B3 at=[21.5, 66.25] rot=0 side=top local=L role="Lisse le courant" near=U1
part C3 C-1210 value="10 µF 50 V" block=B3 at=[13, 65.75] rot=90 side=top local=CIN
  role="Fournit le courant pulsé d'entrée" near=U1
part C4 C-1206 value="100 nF 100 V" block=B3 at=[16.25, 69.75] rot=0 side=top local=CHF
  role="Découplage haute fréquence de l'entrée" near=U1
part C5 C-1206 value="22 µF 10 V" block=B3 at=[25.75, 67.75] rot=90 side=top local=COUT1 role="Filtre la sortie"
  near=L1
part C6 C-1206 value="22 µF 10 V" block=B3 at=[22.75, 71.25] rot=90 side=top local=COUT2 role="Filtre la sortie"
  near=L1
part C7 C-0603 value="100 nF" block=B3 at=[18, 62.75] rot=180 side=top local=CBST
  role="Alimente le transistor côté haut" near=U1
part R2 R-0603 value="52,3 kΩ 1 %" block=B3 at=[19.75, 70.5] rot=270 side=top local=RFB1
  role="Pont de contre-réaction, haut" near=U1
part R3 R-0603 value="10 kΩ 1 %" block=B3 at=[12.75, 70] rot=90 side=top local=RFB2 role="Pont de contre-réaction, bas"
  near=U1
part R4 R-0603 value="100 kΩ" block=B3 at=[14.5, 62.25] rot=180 side=top local=REN
  role="Valide le régulateur dès la mise sous tension" near=U1
part U2 U-LDO-SOT223 value="3,3 V" block=B4 at=[34.5, 20.5] rot=270 side=top local=U role="Régule la tension"
part C8 C-0603 value="1 µF 16 V" block=B4 at=[34.5, 26.25] rot=0 side=top local=CIN role="Stabilise l'entrée" near=U2
part C9 C-0805 value="10 µF 16 V" block=B4 at=[38.25, 26.5] rot=0 side=top local=COUT role="Stabilise la sortie"
  near=U2
part U3 U-MCU-LQFP48 value="" block=B5 at=[36.25, 37.25] rot=270 side=top local=U role="Calcule, mesure et commande"
part C10 C-0603 value="100 nF" block=B5 at=[38, 43.75] rot=180 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U3
part C11 C-0603 value="100 nF" block=B5 at=[29.75, 35] rot=90 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U3
part C12 C-0603 value="100 nF" block=B5 at=[38.5, 30.75] rot=180 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U3
part C13 C-0603 value="100 nF" block=B5 at=[42.75, 39.5] rot=270 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U3
part C14 C-0805 value="4,7 µF" block=B5 at=[41.75, 44] rot=0 side=top local=CB role="Réserve locale" near=U3
part L2 FB-0603 value="600 Ω à 100 MHz" block=B5 at=[38, 45.75] rot=180 side=top local=FB
  role="Isole l'alimentation analogique" near=U3
part C15 C-0603 value="1 µF" block=B5 at=[35.25, 44.5] rot=90 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U3
part C16 C-0603 value="10 nF" block=B5 at=[33.25, 44.5] rot=90 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U3
part R5 R-0603 value="10 kΩ" block=B5 at=[29.75, 38.5] rot=90 side=top local=RR role="Rappel de la remise à zéro"
  near=U3
part C17 C-0603 value="100 nF" block=B5 at=[31.25, 44.5] rot=270 side=top local=CR role="Filtre la remise à zéro"
  near=U3
part R6 R-0603 value="10 kΩ" block=B5 at=[42.75, 36] rot=90 side=top local=RB role="Démarrage sur la mémoire programme"
  near=U3
part Y1 Y-3225 value="8 MHz" block=B5 at=[34, 48.25] rot=180 side=top local=Y role="Base de temps" near=U3
part C18 C-0603 value="15 pF" block=B5 at=[37.25, 48.5] rot=90 side=top local=CX1 role="Charge du quartz" near=Y1
part C19 C-0603 value="15 pF" block=B5 at=[30.75, 48] rot=270 side=top local=CX2 role="Charge du quartz" near=Y1
part J2 J-HDR-2x10 value="" block=B6 at=[2.54, 41] rot=90 side=top local=J role="Liaison vers l'extérieur de la carte"
  edge=true nc=["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]
part U4 U-CAN-SOIC8 value="" block=B7 at=[22.25, 49.25] rot=180 side=top local=U
  role="Traduit les niveaux logiques en niveaux du bus"
part C20 C-0603 value="100 nF" block=B7 at=[27.25, 49] rot=270 side=top local=CV role="Découplage 5 V" near=U4
part C21 C-0603 value="100 nF" block=B7 at=[17.25, 52] rot=270 side=top local=CIO role="Découplage logique" near=U4
part D3 D-TVS-CAN-SOT23 value="24 V" block=B7 at=[20.25, 54.25] rot=90 side=top local=D role="Protège les deux lignes"
part R7 R-1206 value="60,4 Ω 1 %" block=B7 at=[15.75, 48.75] rot=180 side=top local=RT1 role=Demi-terminaison
part R8 R-1206 value="60,4 Ω 1 %" block=B7 at=[15.75, 45.75] rot=180 side=top local=RT2 role=Demi-terminaison near=R7
part C22 C-0603 value="4,7 nF" block=B7 at=[12.25, 49.5] rot=90 side=top local=CT role="Point milieu de la terminaison"
  near=R7
part U5 NTC-0603 value="10 kΩ B 3950" block=B8 at=[43.75, 15] rot=90 side=top local=RT role="Sonde de température"
part R9 R-0603 value="10 kΩ 1 %" block=B8 at=[43.75, 11.5] rot=90 side=top local=RP role="Haut du pont diviseur"
  near=U5
part R10 R-0603 value="1 kΩ" block=B8 at=[45.75, 15] rot=90 side=top local=RF role="Filtre anti-repliement" near=U5
part C23 C-0603 value="1,5 µF" block=B8 at=[47.75, 15] rot=270 side=top local=CF role="Filtre anti-repliement" near=R10
part U6 U-IMU-LGA14 value="" block=B9 at=[50.5, 14.75] rot=0 side=top local=U role="Accéléromètre et gyromètre"
  nc=[INT2]
part C24 C-0603 value="100 nF" block=B9 at=[50.5, 11.75] rot=0 side=top local=CV role=Découplage near=U6
part C25 C-0603 value="100 nF" block=B9 at=[53.25, 13.5] rot=270 side=top local=CIO
  role="Découplage des entrées-sorties" near=U6
part R11 R-0603 value="4,7 kΩ" block=B9 at=[55.25, 15] rot=90 side=top local=RSCL role="Rappel de l'horloge I²C"
  near=U6
part R12 R-0603 value="4,7 kΩ" block=B9 at=[50.5, 9.75] rot=0 side=top local=RSDA role="Rappel des données I²C" near=U6
part D4 LED-0603 value=verte block=B10 at=[56.25, 18.5] rot=90 side=top local=D role=Témoin
part R13 R-0603 value="680 Ω" block=B10 at=[56.25, 22] rot=270 side=top local=R role="Fixe le courant" near=D4
part J3 J-SWD-2x05 value="" block=B11 at=[45, 25.75] rot=270 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part TP1 TP-1.0 value=+24V block=B12 at=[14.75, 82.75] rot=0 side=top local=TP1 role="Accès de mesure à +24V"
part TP2 TP-1.0 value=+5V block=B12 at=[18.75, 82.75] rot=0 side=top local=TP2 role="Accès de mesure à +5V"
part TP3 TP-1.0 value=+3V3 block=B12 at=[16.75, 82.75] rot=0 side=top local=TP3 role="Accès de mesure à +3V3"
part TP4 TP-1.0 value=GND block=B12 at=[20.75, 82.75] rot=0 side=top local=TP4 role="Accès de mesure à GND"
part FID1 FID-1.0 value="" block=B12 at=[10.5, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B12 at=[49.5, 3] rot=0 side=top local=FID2 role="Repère optique de placement" corner=2
part FID3 FID-1.0 value="" block=B12 at=[10.5, 87] rot=0 side=top local=FID3 role="Repère optique de placement"
  corner=3
net +24V_IN class=power voltage=24 current=1 pins=[J1.1, F1.1]
net GND class=ground voltage=0 current=1
  pins=[J1.2, R1.2, D2.A, C1.-, C2.2, U1.GND, C3.2, C4.2, C5.2, C6.2, R3.2, U2.GND, C8.2, C9.2, U3.VSS, U3.VSSA, C14.2, C15.2, C16.2, C17.2, R6.2, C10.2, C11.2, C12.2, C13.2, Y1.GND, C18.2, C19.2, J2.2, J2.8, U4.GND, U4.STB, C20.2, C21.2, D3.GND, C22.2, U5.2, C23.2, U6.GND, U6.SDO, C24.2, C25.2, D4.K, J3.3, J3.5, J3.9, TP4.TP]
net CAN_H class=signal voltage=24 current=0 pins=[J1.3, U4.CANH, D3.IO1, R7.1]
net CAN_L class=signal voltage=24 current=0 pins=[J1.4, U4.CANL, D3.IO2, R8.1]
net B2_FUSED class=power voltage=24 current=1 pins=[F1.2, Q1.D]
net +24V class=power voltage=24 current=1 pins=[Q1.S, D2.K, C1.+, C2.1, D1.K, U1.VIN, C3.1, C4.1, R4.1, TP1.TP]
net B2_GATE class=signal voltage=24 current=0 pins=[Q1.G, R1.1, D1.A]
net B3_SW class=power voltage=24 current=1 pins=[U1.SW, L1.1, C7.2]
net B3_BST class=signal voltage=24 current=0 pins=[U1.BST, C7.1]
net +5V class=power voltage=5 current=1 pins=[L1.2, C5.1, C6.1, R2.1, U2.VIN, C8.1, J2.1, U4.VCC, C20.1, TP2.TP]
net B3_FB class=signal voltage=0 current=0 pins=[U1.FB, R2.2, R3.1]
net B3_EN class=signal voltage=24 current=0 pins=[U1.EN, R4.2]
net +3V3 class=power voltage=3.3 current=0.3
  pins=[U2.VOUT, C9.1, U3.VDD, C10.1, C11.1, C12.1, C13.1, C14.1, L2.1, R5.1, U4.VIO, C21.1, R9.1, U6.VDD, U6.VDDIO, U6.CS, C24.1, C25.1, R11.1, R12.1, J3.1, TP3.TP]
net B5_VDDA class=power voltage=3.3 current=0.02 pins=[U3.VDDA, L2.2, C15.1, C16.1]
net RESET_N class=signal voltage=0 current=0 pins=[U3.NRST, R5.2, C17.1, J3.10]
net B5_BOOT0 class=signal voltage=0 current=0 pins=[U3.BOOT0, R6.1]
net B5_OSC_IN class=signal voltage=0 current=0 pins=[U3.OSC_IN, Y1.X1, C18.1]
net B5_OSC_OUT class=signal voltage=0 current=0 pins=[U3.OSC_OUT, Y1.X2, C19.1]
net PWM_H class=signal voltage=0 current=0 pins=[J2.3, U3.PA8]
net PWM_L class=signal voltage=0 current=0 pins=[J2.4, U3.PA7]
net AIN1 class=signal voltage=0 current=0 pins=[J2.5, U3.PA1]
net AIN2 class=signal voltage=0 current=0 pins=[J2.6, U3.PA2]
net DOUT0 class=signal voltage=0 current=0 pins=[J2.7, U3.PB3]
net CAN_TX class=signal voltage=0 current=0 pins=[U4.TXD, U3.PA12]
net CAN_RX class=signal voltage=0 current=0 pins=[U4.RXD, U3.PA11]
net B7_TERM class=signal voltage=0 current=0 pins=[R7.2, R8.2, C22.1]
net B8_DIV class=signal voltage=0 current=0 pins=[R9.2, U5.1, R10.1]
net AIN0 class=signal voltage=0 current=0 pins=[R10.2, C23.1, U3.PA0]
net I2C_SCL class=signal voltage=0 current=0 pins=[U6.SCL, R11.2, U3.PB6]
net I2C_SDA class=signal voltage=0 current=0 pins=[U6.SDA, R12.2, U3.PB7]
net IMU_INT class=signal voltage=0 current=0 pins=[U6.INT1, U3.PB0]
net LED_STATUS class=signal voltage=3.3 current=0 pins=[R13.1, U3.PA15]
net B10_A class=signal voltage=0 current=0 pins=[R13.2, D4.A]
net SWDIO class=signal voltage=0 current=0 pins=[J3.2, U3.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J3.4, U3.SWCLK]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[60, 90] r=2 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=AR thickness=50 sides=both
  hole at=[5, 5] d=3.4 plated=false land=6 kind=mount
  hole at=[55, 5] d=3.4 plated=false land=6 kind=mount
  hole at=[5, 85] d=3.4 plated=false land=6 kind=mount
  hole at=[55, 85] d=3.4 plated=false land=6 kind=mount
rules fab=standard
  classes = {}
"part" DRV-CTRL-PCB
`;
