/* DynamiteOrbit.ai — the CORE board, written by tools/gen_demo_core.mjs : the small board laid on the top of a CORE of 8 cells
   21700 in parallel, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */
export const DEMO_CORE_1 = `dwiz board/1 CORE-1S8P-PCBA "Carte de CORE 1S8P"
# DynamiteOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description <<<
Posée sur le dessus d'un CORE de 8 cellules 21700 en parallèle (2 × 4) : mesure ses 8 températures — CTN sur les rabats du flex replié en G — et sa tension, équilibre sur ordre, et répond au BMS central du boîtier par RS-485 isolé, le côté bus alimenté par le faisceau, en chaîne d'un CORE au suivant.
>>>
revision A
function F1 parent=null kind=principale name="S'alimenter sur le CORE" block=null
  criterion name=Entrée level="3,2 à 4,2 V, le cell block 1S8P (valeurs du projet)" flex=F0
  criterion name=Rail level="3,0 V, 50 mA" flex=F1
function F2 parent=null kind=principale name="Mesurer les 8 températures" block=null
  criterion name=Capteurs level="8 CTN 10 kΩ, une sous chaque cellule, sur les rabats du flex" flex=F0
  criterion name=Plage level="−20 à 85 °C (exemple à confirmer)" flex=F1
function F3 parent=null kind=principale name="Mesurer la tension du CORE" block=null
  criterion name=Plage level="3,2 à 4,2 V" flex=F0
  criterion name=Condition level="équilibrage coupé pendant la mesure" flex=F1
function F4 parent=null kind=principale name="Équilibrer sur ordre du BMS central" block=null
  criterion name=Purge level="≈ 90 mA à 4,2 V (exemple à confirmer)" flex=F1
function F5 parent=null kind=principale name="Calculer et répondre" block=null
  criterion name=Liaison level="UART, une réponse par tour du BMS central" flex=F1
function F6 parent=null kind=principale name="Communiquer avec le BMS central" block=null
  criterion name=Bus level="RS-485 demi-duplex isolé, côté bus alimenté par le faisceau, en chaîne" flex=F0
  criterion name=Terminaison level="au BMS central et au bout de la chaîne, pas sur chaque carte" flex=F1
function F7 parent=null kind=principale name="Être testable et programmable" block=null
  criterion name=Accès level="connecteur de programmation, points de test des deux côtés de la barrière" flex=F1
function F8 parent=null kind=contrainte name="Tenir sur le dessus du CORE" block=null
  criterion name=Carte level="92,8 × 46,4 mm, à l'enveloppe d'une 21700 (Ø 21,7 mm)" flex=F0
function F9 parent=null kind=contrainte name="Une seule variante pour les 8 CORE" block=null
  criterion name=Adresse level="écrite en mémoire à l'assemblage, vérifiée au démarrage par le BMS central" flex=F1
function F1.1 parent=F1 kind=technique
  name="Raccorder le circuit flexible : +4V2,+4V2,NTC0,NTC1,NTC2,NTC3,NTC4,NTC5,NTC6,NTC7,GND,GND" block=B1 auto=true
  criteria = []
function F1.2 parent=F1 kind=technique name="Réguler 4,2 V vers 3 V, 0,05 A, sans bruit de découpage" block=B2
  auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B3 auto=true
  criteria = []
function F2.2 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B4 auto=true
  criteria = []
function F2.3 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B5 auto=true
  criteria = []
function F2.4 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B6 auto=true
  criteria = []
function F2.5 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B7 auto=true
  criteria = []
function F2.6 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B8 auto=true
  criteria = []
function F2.7 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B9 auto=true
  criteria = []
function F2.8 parent=F2 kind=technique name="Mesurer la température (CTN 10 kΩ), filtre à 10 Hz" block=B10 auto=true
  criteria = []
function F3.1 parent=F3 kind=technique name="Mesurer la tension du bus 4,2 V" block=B11 auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Équilibrer le cell block : 100 mA à 4,2 V" block=B12 auto=true
  criteria = []
function F5.1 parent=F5 kind=technique name="Calculer et piloter : microcontrôleur 32 bits, 48 broches" block=B13
  auto=true
  criteria = []
function F6.1 parent=F6 kind=technique name="Isoler une liaison numérique (3 voies aller, 1 retour)" block=B14
  auto=true
  criteria = []
function F6.2 parent=F6 kind=technique name="Communiquer en RS-485 demi-duplex" block=B15 auto=true
  criteria = []
function F6.3 parent=F6 kind=technique name="Raccorder un faisceau : RS485_A,RS485_B,+5V_ISO,GND_ISO" block=B16
  auto=true
  criteria = []
function F6.4 parent=F6 kind=technique name="Raccorder un faisceau : RS485_A,RS485_B,+5V_ISO,GND_ISO" block=B17
  auto=true
  criteria = []
function F7.1 parent=F7 kind=technique name="Programmer et déboguer le microcontrôleur" block=B18 auto=true
  criteria = []
function F7.2 parent=F7 kind=technique name="Rendre la carte testable et plaçable en machine" block=B19 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 conn_wire name="Connecteur fil à carte" function=F1.1 zone=[1.5, 1.5, 11.5, 25.5]
  connect={P1: +4V2, P2: +4V2, P3: NTC0, P4: NTC1, P5: NTC2, P6: NTC3, P7: NTC4, P8: NTC5, P9: NTC6, P10: NTC7, P11: GND, P12: GND}
  params signals="+4V2,+4V2,NTC0,NTC1,NTC2,NTC3,NTC4,NTC5,NTC6,NTC7,GND,GND" flex=1
block B2 ldo name="Régulateur linéaire" function=F1.2 zone=[10.5, 27.5, 14, 7.5]
  connect={VIN: +4V2, VOUT: +3V, GND: GND}
  params vin=4.2 vout=3 iout=0.05
block B3 ntc name="Mesure de température par CTN" function=F2.1 zone=[47.5, 11, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN0, NTC: NTC8}
  params vref=3 rp=10 fc=10 remote=1
block B4 ntc name="Mesure de température par CTN" function=F2.2 zone=[54, 11, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN1, NTC: NTC9}
  params vref=3 rp=10 fc=10 remote=1
block B5 ntc name="Mesure de température par CTN" function=F2.3 zone=[47.5, 1.5, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN2, NTC: NTC10}
  params vref=3 rp=10 fc=10 remote=1
block B6 ntc name="Mesure de température par CTN" function=F2.4 zone=[54, 1.5, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN3, NTC: NTC11}
  params vref=3 rp=10 fc=10 remote=1
block B7 ntc name="Mesure de température par CTN" function=F2.5 zone=[60.5, 11, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN4, NTC: NTC12}
  params vref=3 rp=10 fc=10 remote=1
block B8 ntc name="Mesure de température par CTN" function=F2.6 zone=[67, 11, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN5, NTC: NTC13}
  params vref=3 rp=10 fc=10 remote=1
block B9 ntc name="Mesure de température par CTN" function=F2.7 zone=[60.5, 1.5, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN6, NTC: NTC14}
  params vref=3 rp=10 fc=10 remote=1
block B10 ntc name="Mesure de température par CTN" function=F2.8 zone=[67, 1.5, 6, 9]
  connect={VREF: +3V, GND: GND, OUT: AIN7, NTC: NTC15}
  params vref=3 rp=10 fc=10 remote=1
block B11 vbus_sense name="Mesure de la tension du bus" function=F3.1 zone=[1.5, 27.5, 9, 7.5]
  connect={VBUS: +4V2, GND: GND, OUT: AIN8}
  params vbus=4.2 vdd=3
block B12 balance name="Équilibrage passif" function=F4.1 zone=[13, 1.5, 11.5, 25.5]
  connect={VCELL: +4V2, IN: DOUT0, GND: GND}
  params v=4.2 i=100
block B13 mcu name=Microcontrôleur function=F5.1 zone=[25, 1.5, 22, 35.5] connect={VDD: +3V, GND: GND, NRST: RESET_N}
  params pins=48 xtal=8 vdd=3
block B14 iso_digital name="Isolation de signaux numériques" function=F6.1 zone=[47.5, 20.5, 25, 24.5]
  connect={INA: UART_TX, OUTA: ISO_UART_TX, INB: RS485_DE, OUTB: ISO_RS485_DE, IND: ISO_UART_RX, OUTD: UART_RX, VDD1: +3V, GND1: GND, VDD2: +5V_ISO, GND2: GND_ISO}
  params v1=3 v2=5 uart=1
block B15 rs485 name="Interface RS-485" function=F6.2 zone=[73, 25, 18.5, 20]
  connect={VCC: +5V_ISO, GND: GND_ISO, DI: ISO_UART_TX, RO: ISO_UART_RX, DE: ISO_RS485_DE, A: RS485_A, B: RS485_B}
  params term=0 bias=0 prot=1 conn=0 nodes=9 iso=1 vdd=5
block B16 conn_wire name="Connecteur fil à carte" function=F6.3 zone=[81.5, 1.5, 10, 23]
  connect={P1: RS485_A, P2: RS485_B, P3: +5V_ISO, P4: GND_ISO}
  params signals="RS485_A,RS485_B,+5V_ISO,GND_ISO" flex=0
block B17 conn_wire name="Connecteur fil à carte" function=F6.4 zone=[1.5, 35.5, 23.5, 10]
  connect={P1: RS485_A, P2: RS485_B, P3: +5V_ISO, P4: GND_ISO}
  params signals="RS485_A,RS485_B,+5V_ISO,GND_ISO" flex=0
block B18 conn_swd name="Connecteur de programmation" function=F7.1 zone=[25, 37, 22, 8]
  connect={VREF: +3V3, SWDIO: SWDIO, SWCLK: SWCLK, NRST: RESET_N, GND: GND}
  params vdd=3.3
block B19 test name="Points de test et mires" function=F7.2 zone=[73, 1.5, 8, 23]
  connect={T1: +4V2, T2: +3V, T3: GND, T4: +5V_ISO, T5: GND_ISO, T6: RS485_A, T7: RS485_B}
  params nets="+4V2,+3V,GND,+5V_ISO,GND_ISO,RS485_A,RS485_B" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part J1 J-FLEX-12 value="" block=B1 at=[1.5, 14.25] rot=90 side=top local=J
  role="Joint du circuit flexible, soudé sous la carte" edge=true nc=[]
part U1 U-LDO-SOT23-5 value="3 V" block=B2 at=[12.25, 29.5] rot=90 side=top local=U role="Régule la tension" nc=[NC]
part C1 C-0603 value="1 µF 16 V" block=B2 at=[15.25, 29] rot=90 side=top local=CIN role="Stabilise l'entrée" near=U1
part C2 C-0805 value="2,2 µF 16 V" block=B2 at=[12.25, 33] rot=0 side=top local=COUT role="Stabilise la sortie" near=U1
part R1 R-0603 value="10 kΩ 1 %" block=B3 at=[49, 13.25] rot=0 side=top local=RP role="Haut du pont diviseur"
part R2 R-0603 value="1 kΩ" block=B3 at=[50.5, 15.25] rot=0 side=top local=RF role="Filtre anti-repliement"
part C3 C-0603 value="15 µF" block=B3 at=[50.5, 17.25] rot=180 side=top local=CF role="Filtre anti-repliement" near=R2
part R3 R-0603 value="10 kΩ 1 %" block=B4 at=[55.5, 13.25] rot=0 side=top local=RP role="Haut du pont diviseur"
part R4 R-0603 value="1 kΩ" block=B4 at=[57, 15.25] rot=0 side=top local=RF role="Filtre anti-repliement"
part C4 C-0603 value="15 µF" block=B4 at=[57, 17.25] rot=180 side=top local=CF role="Filtre anti-repliement" near=R4
part R5 R-0603 value="10 kΩ 1 %" block=B5 at=[49.25, 8.5] rot=270 side=top local=RP role="Haut du pont diviseur"
part R6 R-0603 value="1 kΩ" block=B5 at=[50.5, 5.75] rot=0 side=top local=RF role="Filtre anti-repliement"
part C5 C-0603 value="15 µF" block=B5 at=[51.25, 8.5] rot=90 side=top local=CF role="Filtre anti-repliement" near=R6
part R7 R-0603 value="10 kΩ 1 %" block=B6 at=[55.5, 9.75] rot=0 side=top local=RP role="Haut du pont diviseur"
part R8 R-0603 value="1 kΩ" block=B6 at=[57, 5.75] rot=0 side=top local=RF role="Filtre anti-repliement"
part C6 C-0603 value="15 µF" block=B6 at=[57, 7.75] rot=180 side=top local=CF role="Filtre anti-repliement" near=R8
part R9 R-0603 value="10 kΩ 1 %" block=B7 at=[62, 13.25] rot=0 side=top local=RP role="Haut du pont diviseur"
part R10 R-0603 value="1 kΩ" block=B7 at=[63.5, 15.25] rot=0 side=top local=RF role="Filtre anti-repliement"
part C7 C-0603 value="15 µF" block=B7 at=[63.5, 17.25] rot=180 side=top local=CF role="Filtre anti-repliement" near=R10
part R11 R-0603 value="10 kΩ 1 %" block=B8 at=[68.5, 13.25] rot=0 side=top local=RP role="Haut du pont diviseur"
part R12 R-0603 value="1 kΩ" block=B8 at=[70, 15.25] rot=0 side=top local=RF role="Filtre anti-repliement"
part C8 C-0603 value="15 µF" block=B8 at=[70, 17.25] rot=180 side=top local=CF role="Filtre anti-repliement" near=R12
part R13 R-0603 value="10 kΩ 1 %" block=B9 at=[62, 9.75] rot=0 side=top local=RP role="Haut du pont diviseur"
part R14 R-0603 value="1 kΩ" block=B9 at=[63.5, 5.75] rot=0 side=top local=RF role="Filtre anti-repliement"
part C9 C-0603 value="15 µF" block=B9 at=[63.5, 7.75] rot=180 side=top local=CF role="Filtre anti-repliement" near=R14
part R15 R-0603 value="10 kΩ 1 %" block=B10 at=[68.5, 9.75] rot=0 side=top local=RP role="Haut du pont diviseur"
part R16 R-0603 value="1 kΩ" block=B10 at=[70, 5.75] rot=0 side=top local=RF role="Filtre anti-repliement"
part C10 C-0603 value="15 µF" block=B10 at=[70, 7.75] rot=180 side=top local=CF role="Filtre anti-repliement" near=R16
part R17 R-0805 value="9,53 kΩ 1 %" block=B11 at=[8.25, 28.5] rot=180 side=top local=R1 role="Haut du pont diviseur"
part R18 R-0603 value="10 kΩ 1 %" block=B11 at=[8, 30.75] rot=0 side=top local=R2 role="Bas du pont diviseur" near=R17
part C11 C-0603 value="100 nF" block=B11 at=[8, 32.75] rot=0 side=top local=C
  role="Filtre et réservoir du convertisseur" near=R18
part Q1 Q-NMOS-SOT23-P value="" block=B12 at=[14.75, 24.75] rot=270 side=top local=Q
  role="Ferme la purge sur ordre du BMS central"
part R19 R-2512 value="91 Ω 1 %" block=B12 at=[15, 18.5] rot=90 side=top local=RB1 role="Purge du cell block" near=Q1
part R20 R-2512 value="91 Ω 1 %" block=B12 at=[19.5, 18.5] rot=90 side=top local=RB2 role="Purge du cell block"
  near=R19
part R21 R-0603 value="100 Ω" block=B12 at=[18.5, 25.75] rot=180 side=top local=RG role="Limite le courant de grille"
  near=Q1
part R22 R-0603 value="100 kΩ" block=B12 at=[18.5, 23.75] rot=180 side=top local=RPD
  role="Purge coupée tant que le microcontrôleur démarre" near=Q1
part U2 U-MCU-LQFP48 value="" block=B13 at=[39.25, 15.25] rot=90 side=top local=U role="Calcule, mesure et commande"
part C12 C-0603 value="100 nF" block=B13 at=[37.5, 8.75] rot=0 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U2
part C13 C-0603 value="100 nF" block=B13 at=[45.75, 17.5] rot=270 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U2
part C14 C-0603 value="100 nF" block=B13 at=[37, 21.75] rot=0 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U2
part C15 C-0603 value="100 nF" block=B13 at=[32.75, 13] rot=90 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U2
part C16 C-0805 value="4,7 µF" block=B13 at=[33.75, 8.5] rot=180 side=top local=CB role="Réserve locale" near=U2
part L1 FB-0603 value="600 Ω à 100 MHz" block=B13 at=[37.5, 6.75] rot=0 side=top local=FB
  role="Isole l'alimentation analogique" near=U2
part C17 C-0603 value="1 µF" block=B13 at=[40.25, 8] rot=270 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U2
part C18 C-0603 value="10 nF" block=B13 at=[42.25, 8] rot=270 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U2
part R23 R-0603 value="10 kΩ" block=B13 at=[45.75, 14] rot=270 side=top local=RR role="Rappel de la remise à zéro"
  near=U2
part C19 C-0603 value="100 nF" block=B13 at=[44.25, 8] rot=90 side=top local=CR role="Filtre la remise à zéro" near=U2
part R24 R-0603 value="10 kΩ" block=B13 at=[32.75, 16.5] rot=270 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U2
part Y1 Y-3225 value="8 MHz" block=B13 at=[29.75, 12.5] rot=90 side=top local=Y role="Base de temps" near=U2
part C20 C-0603 value="15 pF" block=B13 at=[29.5, 9.25] rot=0 side=top local=CX1 role="Charge du quartz" near=Y1
part C21 C-0603 value="15 pF" block=B13 at=[29.5, 15.75] rot=180 side=top local=CX2 role="Charge du quartz" near=Y1
part U3 U-ISO-SOIC16W value="" block=B14 at=[56, 28.5] rot=0 side=top local=U role="Franchit la barrière d'isolement"
  nc=[OUTC]
part C22 C-0603 value="100 nF" block=B14 at=[52, 35.25] rot=0 side=top local=C1 role=Découplage pin="1" near=U3
part C23 C-0603 value="100 nF" block=B14 at=[60, 35.25] rot=180 side=top local=C2 role=Découplage pin="16" near=U3
part U4 U-RS485-SOIC8 value="" block=B15 at=[79.25, 30.25] rot=0 side=top local=U
  role="Traduit l'UART en paire différentielle"
part C24 C-0603 value="100 nF" block=B15 at=[84.25, 30] rot=270 side=top local=C role=Découplage near=U4
part R25 R-0603 value="10 kΩ" block=B15 at=[79.5, 26.25] rot=0 side=top local=RDE
  role="Tient l'émetteur coupé tant que le microcontrôleur n'a pas démarré" near=U4
part R26 R-1206 value="10 Ω" block=B15 at=[86.75, 29.75] rot=270 side=top local=RSA
  role="Limite le courant d'une surtension sur A (résistance tenant l'impulsion)" near=U4
part R27 R-1206 value="10 Ω" block=B15 at=[89.75, 27.25] rot=270 side=top local=RSB
  role="Limite le courant d'une surtension sur B (résistance tenant l'impulsion)" near=R26
part D1 D-TVS-485-SOT23 value="12 V" block=B15 at=[87.25, 34.25] rot=90 side=top local=D
  role="Écrête les deux lignes, au plus près du bornier"
part J2 J-WTB-4 value="" block=B16 at=[90.55, 12.75] rot=90 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part J3 J-WTB-4 value="" block=B17 at=[19.75, 44.15] rot=180 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part J4 J-SWD-2x05 value="" block=B18 at=[43.25, 39] rot=0 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part TP1 TP-1.0 value=+4V2 block=B19 at=[73.75, 13.75] rot=0 side=top local=TP1 role="Accès de mesure à +4V2"
part TP2 TP-1.0 value=+3V block=B19 at=[73.75, 10.25] rot=0 side=top local=TP2 role="Accès de mesure à +3V"
part TP3 TP-1.0 value=GND block=B19 at=[73.75, 16.25] rot=0 side=top local=TP3 role="Accès de mesure à GND"
part TP4 TP-1.0 value=+5V_ISO block=B19 at=[80.25, 23.75] rot=0 side=top local=TP4 role="Accès de mesure à +5V_ISO"
part TP5 TP-1.0 value=GND_ISO block=B19 at=[78.25, 23.75] rot=0 side=top local=TP5 role="Accès de mesure à GND_ISO"
part TP6 TP-1.0 value=RS485_A block=B19 at=[80.25, 21.75] rot=0 side=top local=TP6 role="Accès de mesure à RS485_A"
part TP7 TP-1.0 value=RS485_B block=B19 at=[80.25, 12.25] rot=0 side=top local=TP7 role="Accès de mesure à RS485_B"
part FID1 FID-1.0 value="" block=B19 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B19 at=[89.75, 3] rot=0 side=top local=FID2 role="Repère optique de placement"
  corner=2
part FID3 FID-1.0 value="" block=B19 at=[3, 43.4] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
net +4V2 class=power voltage=4.2 current=0.09230769230769231
  pins=[J1.1, J1.2, U1.VIN, C1.1, U1.EN, R17.1, R19.1, R20.1, TP1.TP]
net NTC0 class=signal voltage=0 current=0 pins=[J1.3]
net NTC1 class=signal voltage=0 current=0 pins=[J1.4]
net NTC2 class=signal voltage=0 current=0 pins=[J1.5]
net NTC3 class=signal voltage=0 current=0 pins=[J1.6]
net NTC4 class=signal voltage=0 current=0 pins=[J1.7]
net NTC5 class=signal voltage=0 current=0 pins=[J1.8]
net NTC6 class=signal voltage=0 current=0 pins=[J1.9]
net NTC7 class=signal voltage=0 current=0 pins=[J1.10]
net GND class=ground voltage=0 current=0.09230769230769231
  pins=[J1.11, J1.12, U1.GND, C1.2, C2.2, C3.2, C4.2, C5.2, C6.2, C7.2, C8.2, C9.2, C10.2, R18.2, C11.2, Q1.S, R22.2, U2.VSS, U2.VSSA, C16.2, C17.2, C18.2, C19.2, R24.2, C12.2, C13.2, C14.2, C15.2, Y1.GND, C20.2, C21.2, U3.GND1, C22.2, U3.INC, J4.3, J4.5, J4.9, TP3.TP]
net +3V class=power voltage=3 current=0.15
  pins=[U1.VOUT, C2.1, R1.1, R3.1, R5.1, R7.1, R9.1, R11.1, R13.1, R15.1, U2.VDD, C12.1, C13.1, C14.1, C15.1, C16.1, L1.1, R23.1, U3.VDD1, U3.EN1, C22.1, TP2.TP]
net NTC8 class=signal voltage=0 current=0 pins=[R1.2, R2.1]
net AIN0 class=signal voltage=0 current=0 pins=[R2.2, C3.1, U2.PA0]
net NTC9 class=signal voltage=0 current=0 pins=[R3.2, R4.1]
net AIN1 class=signal voltage=0 current=0 pins=[R4.2, C4.1, U2.PA1]
net NTC10 class=signal voltage=0 current=0 pins=[R5.2, R6.1]
net AIN2 class=signal voltage=0 current=0 pins=[R6.2, C5.1, U2.PA2]
net NTC11 class=signal voltage=0 current=0 pins=[R7.2, R8.1]
net AIN3 class=signal voltage=0 current=0 pins=[R8.2, C6.1, U2.PA3]
net NTC12 class=signal voltage=0 current=0 pins=[R9.2, R10.1]
net AIN4 class=signal voltage=0 current=0 pins=[R10.2, C7.1, U2.PA4]
net NTC13 class=signal voltage=0 current=0 pins=[R11.2, R12.1]
net AIN5 class=signal voltage=0 current=0 pins=[R12.2, C8.1, U2.PA5]
net NTC14 class=signal voltage=0 current=0 pins=[R13.2, R14.1]
net AIN6 class=signal voltage=0 current=0 pins=[R14.2, C9.1, U2.PA6]
net NTC15 class=signal voltage=0 current=0 pins=[R15.2, R16.1]
net AIN7 class=signal voltage=0 current=0 pins=[R16.2, C10.1, U2.PA7]
net AIN8 class=signal voltage=0 current=0 pins=[R17.2, R18.1, C11.1, U2.PB0]
net B12_BLEED class=power voltage=4.2 current=0.09230769230769231 pins=[R19.2, R20.2, Q1.D]
net B12_GATE class=signal voltage=0 current=0 pins=[R21.2, Q1.G, R22.1]
net DOUT0 class=signal voltage=0 current=0 pins=[R21.1, U2.PB3]
net B13_VDDA class=power voltage=3 current=0.02 pins=[U2.VDDA, L1.2, C17.1, C18.1]
net RESET_N class=signal voltage=0 current=0 pins=[U2.NRST, R23.2, C19.1, J4.10]
net B13_BOOT0 class=signal voltage=0 current=0 pins=[U2.BOOT0, R24.1]
net B13_OSC_IN class=signal voltage=0 current=0 pins=[U2.OSC_IN, Y1.X1, C20.1]
net B13_OSC_OUT class=signal voltage=0 current=0 pins=[U2.OSC_OUT, Y1.X2, C21.1]
net +5V_ISO class=power voltage=5 current=0.06 pins=[U3.VDD2, U3.EN2, C23.1, U4.VCC, C24.1, J2.3, J3.3, TP4.TP]
net GND_ISO class=ground voltage=0 current=0 pins=[U3.GND2, C23.2, U4.GND, C24.2, R25.2, D1.GND, J2.4, J3.4, TP5.TP]
net UART_TX class=signal voltage=0 current=0 pins=[U3.INA, U2.PA9]
net ISO_UART_TX class=signal voltage=0 current=0 pins=[U3.OUTA, U4.DI]
net RS485_DE class=signal voltage=0 current=0 pins=[U3.INB, U2.PB1]
net ISO_RS485_DE class=signal voltage=0 current=0 pins=[U3.OUTB, U4.DE, U4.RE_N, R25.1]
net ISO_UART_RX class=signal voltage=0 current=0 pins=[U3.IND, U4.RO]
net UART_RX class=signal voltage=0 current=0 pins=[U3.OUTD, U2.PA10]
net B15_A class=signal voltage=12 current=0 pins=[U4.A, R26.1]
net B15_B class=signal voltage=12 current=0 pins=[U4.B, R27.1]
net RS485_A class=signal voltage=12 current=0 pins=[R26.2, D1.IO1, J2.1, J3.1, TP6.TP]
net RS485_B class=signal voltage=12 current=0 pins=[R27.2, D1.IO2, J2.2, J3.2, TP7.TP]
net +3V3 class=power voltage=3.3 current=0.01 pins=[J4.1]
net SWDIO class=signal voltage=0 current=0 pins=[J4.2, U2.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J4.4, U2.SWCLK]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[92.8, 46.4] r=1 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
planes = []
track AIN8 top w=0.25 pts=[[7.3, 28.5], [7.25, 29], [7.25, 30.5], [7.2, 30.75]]
track AIN8 top w=0.25 pts=[[7.2, 30.75], [7.5, 31], [7.5, 32.5], [7.2, 32.75]]
track AIN8 top w=0.2 pts=[[7.3, 28.5], [7.75, 28], [8, 27.75], [8, 27.5]]
track AIN8 in2 w=0.2 pts=[[8, 27.5], [29.75, 27.5], [42.25, 15]]
track AIN8 top w=0.2 pts=[[42.25, 15], [43.5, 15]]
track AIN6 top w=0.25 pts=[[64.3, 5.75], [65.25, 5.75]]
track AIN6 bottom w=0.25 pts=[[65.25, 5.75], [65.25, 7.75]]
track AIN6 top w=0.25 pts=[[65.25, 7.75], [64.3, 7.75]]
track AIN6 bottom w=0.2
  pts=[[65.25, 7.75], [62.75, 10.25], [62.5, 10.25], [60.25, 12.5], [46.5, 12.5], [45.25, 13.75], [42.5, 13.75], [42.25, 14]]
track AIN6 top w=0.2 pts=[[42.25, 14], [43.5, 14]]
track B13_OSC_IN top w=0.25 pts=[[38.5, 11], [38.5, 9.75], [37.25, 9.75]]
track B13_OSC_IN in2 w=0.25 pts=[[37.25, 9.75], [30.5, 9.75], [30, 10.25], [29.5, 10.25]]
track B13_OSC_IN top w=0.25 pts=[[29.5, 10.25], [29.5, 10.75], [28.95, 11.4]]
track B13_OSC_IN top w=0.25 pts=[[29.5, 10.25], [29.25, 10], [29.25, 9.75], [29, 9.5], [28.7, 9.25]]
track AIN0 top w=0.25 pts=[[51.3, 15.25], [51.25, 15.5], [51.25, 17], [51.3, 17.25]]
track AIN0 top w=0.2 pts=[[51.25, 16.25], [50.25, 16.25]]
track AIN0 in2 w=0.2 pts=[[50.25, 16.25], [45.75, 16.25], [42.75, 13.25], [42.5, 13.25], [41.5, 12.25], [41, 12.25]]
track AIN0 top w=0.2 pts=[[41, 12.25], [41, 11]]
track GND_ISO top w=0.5
  pts=[[60.65, 24.055], [59.75, 24.25], [59.5, 24.25], [59, 24.75], [59, 31], [59.25, 31.25], [59.5, 31.25], [59.75, 31.5], [60.65, 31.675]]
track GND_ISO top w=0.5 pts=[[60.65, 31.675], [59.75, 31.75], [59.5, 31.75], [59, 32.25], [59, 35], [59.2, 35.25]]
track GND_ISO top w=0.5 pts=[[60.65, 24.055], [61.5, 24], [77.5, 24], [77.75, 23.75], [78.25, 23.75]]
track GND_ISO top w=0.5 pts=[[78.25, 23.75], [79.75, 25.25], [79.75, 25.5], [80, 25.75], [80, 26], [80.3, 26.25]]
track GND_ISO top w=0.5 pts=[[80.3, 26.25], [80.75, 26.5], [81, 26.75], [81, 28], [81.25, 28.25], [81.95, 28.345]]
track GND_ISO top w=0.5 pts=[[81.95, 28.345], [82.5, 28.5], [83.75, 28.5], [84, 28.75], [84.25, 29.2]]
track GND_ISO top w=0.5
  pts=[[84.25, 29.2], [84.5, 29.5], [85, 29.5], [85.25, 29.75], [85.25, 34], [85.5, 34.25], [86.25, 34.25], [87, 35], [87.25, 35.35]]
track GND_ISO top w=0.5 pts=[[80.3, 26.25], [80.75, 26], [90.25, 16.5], [90.25, 16.25], [90.55, 15.75]]
track GND_ISO top w=0.5
  pts=[[59.2, 35.25], [58.75, 35.5], [56, 35.5], [54.75, 36.75], [53.25, 36.75], [53, 37], [50.5, 37], [47.5, 40], [47.25, 40], [46.5, 40.75], [20, 40.75], [17, 43.75], [16.75, 44.15]]
track B12_BLEED top w=0.5 pts=[[15, 21.45], [14.5, 22], [14.5, 23.25], [14.75, 23.65]]
track B12_BLEED top w=0.5 pts=[[15, 21.45], [16.5, 21.75], [18, 21.75], [19.5, 21.45]]
track B13_VDDA top w=0.15 pts=[[40.5, 11], [40.5, 9.25], [40.25, 8.8]]
track B13_VDDA top w=0.5 pts=[[40.25, 8.8], [40.5, 8.5], [42, 8.5], [42.25, 8.8]]
track B13_VDDA in2 w=0.5 pts=[[41.25, 8.5], [39.75, 8.5], [39.5, 8.25], [39.25, 8.25], [38.75, 7.75], [37.5, 7.75]]
track B13_VDDA top w=0.5 pts=[[37.5, 7.75], [37.75, 7.75], [38, 7.5], [38, 7], [38.3, 6.75]]
track +4V2 top w=0.5 pts=[[1.5, 8.75], [1.5, 9.75]]
track +4V2 top w=0.5 pts=[[1.5, 9.75], [5.25, 9.75], [6.25, 10.75], [9.25, 10.75], [13.5, 15], [15, 15.55]]
track +4V2 top w=0.5 pts=[[15, 15.55], [16.5, 15], [18, 15], [19.5, 15.55]]
track +4V2 top w=0.5 pts=[[15, 15.55], [14.75, 16.25], [14.75, 16.75]]
track +4V2 bottom w=0.5 pts=[[14.75, 16.75], [14.75, 26.75]]
track +4V2 top w=0.5 pts=[[14.75, 26.75], [15, 27], [15, 27.75], [15.25, 28.2]]
track +4V2 top w=0.5 pts=[[15.25, 28.2], [15, 28], [13.5, 28], [13.2, 28.3]]
track +4V2 bottom w=0.5 pts=[[14.75, 26.75], [11.75, 26.75]]
`;
