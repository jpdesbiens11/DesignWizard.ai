/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p, written by tools/gen_demo_bms3.mjs, from its functions to its copper, in the
   .dwiz format. Do not edit by hand : change the generator and run it again. */
export const DEMO_BMS3_2 = `part C34 C-0603 value="100 nF" block=B28 at=[37.25, 63] rot=90 side=top local=C
  role="Filtre les rebonds et les parasites" near=R40
part R41 R-0805 value="33 kΩ 1 %" block=B29 at=[27.75, 72] rot=0 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R42 R-0603 value="10 kΩ 1 %" block=B29 at=[30.75, 71] rot=270 side=top local=R2 role="Bas du pont" near=R41
part D16 D-ZEN-SOD123 value="3,3 V" block=B29 at=[29.25, 68] rot=0 side=top local=DZ role="Écrête les surtensions"
  near=R42
part C35 C-0603 value="100 nF" block=B29 at=[30.5, 74.25] rot=180 side=top local=C
  role="Filtre les rebonds et les parasites" near=R42
part R43 R-0805 value="33 kΩ 1 %" block=B30 at=[34.25, 71.5] rot=0 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R44 R-0603 value="10 kΩ 1 %" block=B30 at=[34, 69.25] rot=180 side=top local=R2 role="Bas du pont" near=R43
part D17 D-ZEN-SOD123 value="3,3 V" block=B30 at=[34.75, 67] rot=180 side=top local=DZ role="Écrête les surtensions"
  near=R44
part C36 C-0603 value="100 nF" block=B30 at=[37.25, 70] rot=90 side=top local=C
  role="Filtre les rebonds et les parasites" near=R44
part J5 J-WTB-8 value="" block=B31 at=[13.75, 73.95] rot=180 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U11 U-MCU-LQFP48 value="" block=B32 at=[61.75, 53.25] rot=270 side=top local=U role="Calcule, mesure et commande"
part C37 C-0603 value="100 nF" block=B32 at=[63.5, 59.75] rot=180 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U11
part C38 C-0603 value="100 nF" block=B32 at=[58.5, 59.75] rot=0 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U11
part C39 C-0603 value="100 nF" block=B32 at=[68.25, 49.5] rot=90 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U11
part C40 C-0603 value="100 nF" block=B32 at=[68.25, 55.5] rot=270 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U11
part C41 C-0805 value="4,7 µF" block=B32 at=[70.5, 55.75] rot=270 side=top local=CB role="Réserve locale" near=U11
part L3 FB-0603 value="600 Ω à 100 MHz" block=B32 at=[69.75, 59.5] rot=90 side=top local=FB
  role="Isole l'alimentation analogique" near=U11
part C42 C-0603 value="1 µF" block=B32 at=[67, 59.75] rot=0 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U11
part C43 C-0603 value="10 nF" block=B32 at=[69, 52.75] rot=0 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U11
part R45 R-0603 value="10 kΩ" block=B32 at=[70.25, 50] rot=90 side=top local=RR role="Rappel de la remise à zéro"
  near=U11
part C44 C-0603 value="100 nF" block=B32 at=[71.75, 59.5] rot=270 side=top local=CR role="Filtre la remise à zéro"
  near=U11
part R46 R-0603 value="10 kΩ" block=B32 at=[72.75, 54.5] rot=90 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U11
part Y1 Y-3225 value="8 MHz" block=B32 at=[73.25, 50.5] rot=270 side=top local=Y role="Base de temps" near=U11
part C45 C-0603 value="15 pF" block=B32 at=[73.75, 58] rot=90 side=top local=CX1 role="Charge du quartz" near=Y1
part C46 C-0603 value="15 pF" block=B32 at=[73, 47.25] rot=0 side=top local=CX2 role="Charge du quartz" near=Y1
part U12 U-EEPROM-SOIC8 value="64 kbit" block=B33 at=[68.75, 33.75] rot=90 side=top local=U role="Mémoire non volatile"
part C47 C-0603 value="100 nF" block=B33 at=[72.75, 33] rot=270 side=top local=C role=Découplage near=U12
part J6 J-SWD-2x05 value="" block=B34 at=[66.25, 45.5] rot=0 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part TP1 TP-1.0 value=VSYS block=B35 at=[35.75, 26.75] rot=0 side=top local=TP1 role="Accès de mesure à VSYS"
part TP2 TP-1.0 value=+3V3 block=B35 at=[44.25, 41.25] rot=0 side=top local=TP2 role="Accès de mesure à +3V3"
part TP3 TP-1.0 value=GND block=B35 at=[35.25, 39.25] rot=0 side=top local=TP3 role="Accès de mesure à GND"
part TP4 TP-1.0 value=GND_ISO block=B35 at=[55.25, 28.75] rot=0 side=top local=TP4 role="Accès de mesure à GND_ISO"
part TP5 TP-1.0 value=GND_CISO block=B35 at=[21.25, 42.25] rot=0 side=top local=TP5 role="Accès de mesure à GND_CISO"
part FID1 FID-1.0 value="" block=B35 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B35 at=[43.25, 3] rot=0 side=top local=FID2 role="Repère optique de placement"
  corner=2
part FID3 FID-1.0 value="" block=B35 at=[39, 73.2] rot=0 side=top local=FID3 role="Repère optique de placement"
  corner=3
part D18 LED-0603 value=verte block=B36 at=[52, 47.25] rot=0 side=top local=D role=Témoin
part R47 R-0603 value="680 Ω" block=B36 at=[54.75, 48] rot=270 side=top local=R role="Fixe le courant" near=D18
part D19 LED-0603 value=jaune block=B37 at=[50.75, 52] rot=90 side=top local=D role=Témoin
part R48 R-0603 value="680 Ω" block=B37 at=[53.5, 52.75] rot=180 side=top local=R role="Fixe le courant" near=D19
part D20 LED-0603 value=rouge block=B38 at=[38.75, 35.5] rot=90 side=top local=D role=Témoin
part R49 R-0603 value="680 Ω" block=B38 at=[38.75, 32] rot=90 side=top local=R role="Fixe le courant" near=D20
part BZ1 BZ-12 value="" block=B39 at=[45.25, 60.25] rot=0 side=top local=BZ role="Avertisseur piézo"
part Q8 Q-NMOS-SOT23 value="" block=B39 at=[49.75, 68.75] rot=270 side=top local=Q role="Commute l'avertisseur"
  near=BZ1
part R50 R-0603 value="1 kΩ" block=B39 at=[52.75, 60] rot=90 side=top local=RD
  role="Décharge la capacité du piézo à chaque période" near=BZ1
part R51 R-0603 value="100 Ω" block=B39 at=[52.75, 68.5] rot=90 side=top local=RG role="Limite le courant de grille"
  near=Q8
part R52 R-0603 value="100 kΩ" block=B39 at=[49.5, 71.75] rot=180 side=top local=RPD
  role="Silence pendant le démarrage" near=Q8
net +12V_IN class=power voltage=12 current=6 pins=[J1.1, F1.1]
net GND class=ground voltage=0 current=6
  pins=[J1.2, R1.2, D1.A, C1.-, C2.2, J2.2, R2.2, D3.A, C3.-, C4.2, C5.2, U1.GND, C6.2, C7.2, C8.2, C9.2, R4.2, U2.GND, C11.2, C12.2, U3.GND, C13.2, R7.2, D6.A, C14.2, R9.2, C15.2, U4.GND1, C16.2, U5.GND1, C18.2, U5.INC, J4.5, U7.GND, C21.2, C23.2, R21.2, C24.2, C25.2, Q3.S, R25.2, Q4.S, R27.2, Q5.S, R29.2, R31.2, D11.A, C26.2, Q6.S, R33.2, Q7.S, R35.2, U8.GND1, C27.2, U9.GND1, C29.2, U9.INC, U9.INB, R40.2, D15.A, C34.2, R42.2, D16.A, C35.2, R44.2, D17.A, C36.2, J5.8, U11.VSS, U11.VSSA, C41.2, C42.2, C43.2, C44.2, R46.2, C37.2, C38.2, C39.2, C40.2, Y1.GND, C45.2, C46.2, U12.GND, U12.A0, U12.A1, U12.A2, U12.WP, C47.2, J6.3, J6.5, J6.9, TP3.TP, D18.K, D19.K, D20.K, Q8.S, R52.2]
net B2_FUSED class=power voltage=12 current=6 pins=[F1.2, Q1.D]
net +12V class=power voltage=12 current=6
  pins=[Q1.S, D1.K, C1.+, C2.1, D5.A, U4.VIN, C16.1, D8.K, D9.K, D10.K, D12.K, D13.K]
net B2_GATE class=signal voltage=12 current=0 pins=[Q1.G, R1.1]
net +34V_IN class=power voltage=34 current=1 pins=[J2.1, F2.1]
net B4_FUSED class=power voltage=34 current=1 pins=[F2.2, Q2.D]
net +34V class=power voltage=34 current=1 pins=[Q2.S, D3.K, C3.+, C4.1, D2.K, D4.A, R8.1]
net B4_GATE class=signal voltage=34 current=0 pins=[Q2.G, R2.1, D2.A]
net VSYS class=power voltage=34 current=0.5 pins=[D4.K, D5.K, C5.1, U1.VIN, C6.1, C7.1, R5.1, TP1.TP]
net B6_SW class=power voltage=34 current=1 pins=[U1.SW, L1.1, C10.2]
net B6_BST class=signal voltage=34 current=0 pins=[U1.BST, C10.1]
net +5V class=power voltage=5 current=1 pins=[L1.2, C8.1, C9.1, R3.1, U2.VIN, C11.1, U8.VIN, C27.1, BZ1.+, R50.1]
net B6_FB class=signal voltage=0 current=0 pins=[U1.FB, R3.2, R4.1]
net B6_EN class=signal voltage=34 current=0 pins=[U1.EN, R5.2]
net +3V3 class=power voltage=3.3 current=0.2
  pins=[U2.VOUT, C12.1, U3.VCC, C13.1, U5.VDD1, U5.EN1, C18.1, U7.VS, C21.1, R22.1, U9.VDD1, U9.EN1, C29.1, U11.VDD, C37.1, C38.1, C39.1, C40.1, C41.1, L3.1, R45.1, U12.VCC, C47.1, J6.1, TP2.TP]
net RESET_N class=signal voltage=0 current=0 pins=[U3.RESET_N, U11.NRST, R45.2, C44.1, J6.10]
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
net VOUT_TAP class=power voltage=34 current=0.001 pins=[J4.3, R20.1]
net NTC0 class=signal voltage=0 current=0 pins=[J4.4]
net B16_SP class=signal voltage=0 current=0 pins=[R17.2, C22.1, U7.IN+]
net B16_SN class=signal voltage=0 current=0 pins=[R18.2, C22.2, U7.IN-]
net B16_AMP class=signal voltage=0 current=0 pins=[U7.OUT, R19.1]
net AIN1 class=signal voltage=0 current=0 pins=[R19.2, C23.1, U11.PA1]
net AIN2 class=signal voltage=0 current=0 pins=[R20.2, R21.1, C24.1, U11.PA2]
net NTC1 class=signal voltage=0 current=0 pins=[R22.2, R23.1]
net AIN3 class=signal voltage=0 current=0 pins=[R23.2, C25.1, U11.PA3]
net CONTACTEUR_OUT class=power voltage=12 current=1 pins=[Q3.D, D8.A]
net B19_GATE class=signal voltage=0 current=0 pins=[R24.2, Q3.G, R25.1]
net DOUT0 class=signal voltage=0 current=0 pins=[R24.1, U11.PB3]
net PRECHARGE_OUT class=power voltage=12 current=0.5 pins=[Q4.D, D9.A]
net B20_GATE class=signal voltage=0 current=0 pins=[R26.2, Q4.G, R27.1]
net DOUT1 class=signal voltage=0 current=0 pins=[R26.1, U11.PB4]
net PYRO_OUT class=power voltage=12 current=2 pins=[Q5.D, D10.A]
net B21_GATE class=signal voltage=0 current=0 pins=[R28.2, Q5.G, R29.1]
net DOUT2 class=signal voltage=0 current=0 pins=[R28.1, U11.PB5]
net AUX_IN class=signal voltage=12 current=0 pins=[R30.1]
net DIN1 class=signal voltage=0 current=0 pins=[R30.2, R31.1, D11.K, C26.1, U11.PC14]
net PUMP_OUT class=power voltage=12 current=2 pins=[Q6.D, D12.A]
net B23_GATE class=signal voltage=0 current=0 pins=[R32.2, Q6.G, R33.1]
net DOUT3 class=signal voltage=0 current=0 pins=[R32.1, U11.PB2]
net FAN_OUT class=power voltage=12 current=1 pins=[Q7.D, D13.A]
net B24_GATE class=signal voltage=0 current=0 pins=[R34.2, Q7.G, R35.1]
net DOUT4 class=signal voltage=0 current=0 pins=[R34.1, U11.PB14]
net +5V_CISO class=power voltage=5 current=0.2
  pins=[U8.VOUT, C28.1, R36.1, U9.VDD2, U9.EN2, C30.1, U10.VCC, C31.1, U10.VIO, C32.1]
net GND_CISO class=ground voltage=0 current=0
  pins=[U8.GND2, C28.2, R36.2, U9.GND2, C30.2, U10.GND, U10.STB, C31.2, C32.2, D14.GND, C33.2, J5.3, TP5.TP]
net CAN_TX class=signal voltage=0 current=0 pins=[U9.INA, U11.PA12]
net ISO_CAN_TX class=signal voltage=0 current=0 pins=[U9.OUTA, U10.TXD]
net ISO_CAN_SPARE class=signal voltage=0 current=0 pins=[U9.OUTB]
net ISO_CAN_RX class=signal voltage=0 current=0 pins=[U9.IND, U10.RXD]
net CAN_RX class=signal voltage=0 current=0 pins=[U9.OUTD, U11.PA11]
net B27_CANH_IC class=signal voltage=24 current=0 pins=[U10.CANH, L2.1]
net B27_CANL_IC class=signal voltage=24 current=0 pins=[U10.CANL, L2.2]
net CAN_H class=signal voltage=24 current=0 pins=[L2.4, D14.IO1, R37.1, J5.1]
net CAN_L class=signal voltage=24 current=0 pins=[L2.3, D14.IO2, R38.1, J5.2]
net B27_TERM class=signal voltage=0 current=0 pins=[R37.2, R38.2, C33.1]
net ENABLE_IN class=signal voltage=12 current=0 pins=[R39.1, J5.5]
net DIN2 class=signal voltage=0 current=0 pins=[R39.2, R40.1, D15.K, C34.1, U11.PC15]
net PRES_IN class=signal voltage=12 current=0 pins=[R41.1, J5.6]
net DIN3 class=signal voltage=0 current=0 pins=[R41.2, R42.1, D16.K, C35.1, U11.PB12]
net ACK_IN class=signal voltage=12 current=0 pins=[R43.1, J5.7]
net DIN4 class=signal voltage=0 current=0 pins=[R43.2, R44.1, D17.K, C36.1, U11.PB13]
net B32_VDDA class=power voltage=3.3 current=0.02 pins=[U11.VDDA, L3.2, C42.1, C43.1]
net B32_BOOT0 class=signal voltage=0 current=0 pins=[U11.BOOT0, R46.1]
net B32_OSC_IN class=signal voltage=0 current=0 pins=[U11.OSC_IN, Y1.X1, C45.1]
net B32_OSC_OUT class=signal voltage=0 current=0 pins=[U11.OSC_OUT, Y1.X2, C46.1]
net I2C_SCL class=signal voltage=0 current=0 pins=[U12.SCL, U11.PB6]
net I2C_SDA class=signal voltage=0 current=0 pins=[U12.SDA, U11.PB7]
net SWDIO class=signal voltage=0 current=0 pins=[J6.2, U11.SWDIO]
net SWCLK class=signal voltage=0 current=0 pins=[J6.4, U11.SWCLK]
net LED_STATUS class=signal voltage=3.3 current=0 pins=[R47.1, U11.PA15]
net B36_A class=signal voltage=0 current=0 pins=[R47.2, D18.A]
net LED_WARN class=signal voltage=3.3 current=0 pins=[R48.1, U11.PB10]
net B37_A class=signal voltage=0 current=0 pins=[R48.2, D19.A]
net LED_FAULT class=signal voltage=3.3 current=0 pins=[R49.1, U11.PB11]
net B38_A class=signal voltage=0 current=0 pins=[R49.2, D20.A]
net B39_DRAIN class=signal voltage=0 current=0 pins=[BZ1.-, R50.2, Q8.D]
net B39_GATE class=signal voltage=0 current=0 pins=[R51.2, Q8.G, R52.1]
net DOUT5 class=signal voltage=0 current=0 pins=[R51.1, U11.PB15]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[76.2, 76.2] r=1 t=1.6 layers=4 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
planes = []
track +5V_CISO top w=0.5 pts=[[9.25, 53.31], [8.5, 53.5], [5, 53.5], [4.5, 53.2]]
track +5V_CISO top w=0.5 pts=[[9.25, 53.31], [10, 53.5], [14, 53.5], [14.055, 54.15]]
track +5V_CISO top w=0.5
  pts=[[14.055, 54.15], [14, 55], [14, 55.5], [13.75, 55.75], [13.75, 56.25], [13.5, 56.5], [13.5, 59], [13.75, 59.25], [14, 59.25], [14.5, 59.75], [14.75, 60.2]]
track +5V_CISO top w=0.5
  pts=[[14.75, 60.2], [15, 59.75], [17.75, 59.75], [18.25, 59.25], [18.5, 59.25], [19, 58.75], [19, 58.5], [19.25, 58.25], [19.385, 57.55]]
track +5V_CISO top w=0.5
  pts=[[19.385, 57.55], [19.5, 57], [19.75, 56.75], [19.75, 56.25], [22, 56.25], [22.5, 56.75], [22.75, 57.2]]
track +5V_CISO top w=0.5 pts=[[21.75, 56.25], [21.75, 55], [21.675, 54.15]]
track +5V_CISO top w=0.5 pts=[[18, 59.5], [20.5, 62], [20.5, 62.25], [20.655, 62.95]]
track +5V_CISO top w=0.5 pts=[[4.5, 53.2], [4, 52.75], [3.75, 52.75], [3.25, 52.25], [3.25, 44], [2.8, 43.5]]
track +5V_CISO bottom w=0.5
  pts=[[9.25, 53.31], [9.75, 52.75], [9.75, 52.5], [10.5, 51.75], [10.5, 51.5], [10.75, 51.25], [10.75, 50.5], [11.5, 49.75], [11.5, 49.5], [12, 49], [12, 47.25], [12.75, 46.5], [12.75, 46.25], [17, 42], [17, 41.75], [17.5, 41.25]]
track +5V_CISO top w=0.5 pts=[[17.5, 41.25], [17.5, 42], [17.7, 42.25]]
track AIN1 top w=0.25 pts=[[63.75, 64.3], [63.75, 66.2]]
track AIN1 top w=0.2 pts=[[63.75, 64.3], [63.5, 64], [63.25, 64], [62.75, 63.5]]
track AIN1 bottom w=0.2 pts=[[62.75, 63.5], [61.75, 62.5], [61.75, 60.5], [59.75, 58.5], [59.75, 56.5], [59.5, 56.25]]
track AIN1 top w=0.2 pts=[[59.5, 56.25], [59.5, 57.5]]
track DOUT1 top w=0.2 pts=[[44.75, 36.2], [45, 36.5], [47.25, 36.5]]
track DOUT1 bottom w=0.2 pts=[[47.25, 36.5], [61, 50.25]]
track DOUT1 top w=0.2 pts=[[61, 50.25], [61.75, 50.25], [62.5, 51], [63.75, 51], [64.75, 52], [66, 52]]
track GND_ISO top w=0.5 pts=[[47.77, 17.75], [48, 17], [48, 13.5], [48.3, 13]]
track GND_ISO top w=0.5 pts=[[48.3, 13], [48.5, 12.5], [48.5, 11], [48.3, 10.5]]
track GND_ISO top w=0.5
  pts=[[48.3, 10.5], [48.75, 10], [49, 9.75], [49, 8.5], [49.25, 8.25], [49.25, 7.25], [49.75, 7.25], [50, 7], [50.25, 6.7]]
track GND_ISO top w=0.5 pts=[[50.25, 6.7], [50.5, 6.25], [52.25, 6.25], [52.345, 5.55]]
track GND_ISO top w=0.5 pts=[[52.345, 5.55], [52.5, 5], [52.75, 4.75], [52.75, 3.5], [53.2, 3.25]]
track GND_ISO top w=0.5 pts=[[49.25, 7.75], [47.25, 7.75], [46.5, 7], [46.5, 5.25], [46.25, 4.8]]
track GND_ISO top w=0.5
  pts=[[52.75, 4.25], [56.25, 4.25], [56.5, 4], [56.75, 4], [57, 3.75], [58.5, 3.75], [58.75, 3.5], [59.15, 3.25]]
track GND_ISO top w=0.5
  pts=[[47.77, 17.75], [48.25, 18.25], [48.5, 18.25], [49.25, 19], [49.5, 19], [49.75, 19.25], [55.25, 19.25], [56.5, 20.5], [56.75, 20.5], [57, 20.75], [57.85, 20.825]]
track GND_ISO top w=0.5 pts=[[57.85, 20.825], [58.75, 20.75], [59, 20.75], [59.5, 20.25], [59.5, 17.5], [59.3, 17.25]]
track GND_ISO top w=0.5
  pts=[[57.85, 20.825], [58.75, 21], [59, 21], [59.5, 21.5], [59.5, 27.75], [59.25, 28], [59, 28], [58.75, 28.25], [57.85, 28.445]]
track GND_ISO top w=0.5 pts=[[57.85, 28.445], [57, 28.5], [56, 28.5], [55.75, 28.75], [55.25, 28.75]]
track GND_ISO top w=0.5 pts=[[59.15, 3.25], [64.5, 3.25], [64.75, 3.5], [70.75, 3.5], [71.5, 2.75], [71.75, 2.25]]
track PUMP_OUT top w=0.78 pts=[[50.35, 33.25], [50.25, 33.5], [50.25, 36.25], [50.9, 37]]
track PRECHARGE_OUT top w=0.5
  pts=[[41.75, 35.65], [42, 35.25], [42.75, 35.25], [43.25, 34.75], [43.25, 32.5], [42.75, 32], [42, 31.1]]
track FAN_OUT top w=0.5
  pts=[[58.35, 33.25], [58.75, 33.5], [59, 33.75], [59, 34.5], [59.25, 34.75], [62, 34.75], [62.25, 34.5], [63, 33.4]]
track PYRO_OUT top w=0.78
  pts=[[48.25, 27.65], [48, 27.25], [46.5, 27.25], [46, 26.75], [46, 24.25], [46.5, 23.75], [47.6, 23]]
track CONTACTEUR_OUT top w=0.5 pts=[[31.75, 40.65], [31.5, 40.25], [31.5, 36.25], [31.4, 35.5]]
track B2_FUSED top w=3.56 pts=[[25.25, 30.7], [24.75, 31.25], [24.75, 33.75], [25.6, 36.75]]
track +34V_IN top w=0.5 pts=[[3.5, 13], [4.5, 12], [11.75, 12], [12.75, 11], [13.3, 10.25]]
track VOUT_TAP top w=0.5
  pts=[[73.95, 68.25], [73.5, 68.5], [70, 68.5], [69.25, 69.25], [66.75, 69.25], [64.5, 71.5], [64.2, 72]]
track SHUNT_P in2 w=0.15
  pts=[[73.95, 72.25], [73.5, 71.75], [70, 71.75], [69.5, 71.25], [69, 71.25], [68.75, 71], [66.25, 71], [64.5, 69.25]]
track SHUNT_P top w=0.15
  pts=[[64.5, 69.25], [64.25, 69], [62.75, 69], [62.5, 68.75], [62.5, 67.75], [62.25, 67.5], [62.25, 67], [61.8, 66.75]]
track B4_FUSED top w=0.5 pts=[[16.2, 10.25], [16.75, 9.5], [19.5, 9.5], [20.75, 8.25], [30.25, 8.25], [33.25, 9.6]]
track SHUNT_N in2 w=0.5
  pts=[[73.95, 70.25], [73.5, 70], [70.75, 70], [69.75, 69], [69.5, 69], [69.25, 68.75], [66.25, 68.75], [65.5, 68], [65, 68], [64.75, 67.75], [59.5, 67.75], [58, 69.25]]
track SHUNT_N top w=0.5 pts=[[58, 69.25], [58, 68.75], [57.75, 68.3]]
track +12V_IN top w=1.05
  pts=[[1.75, 28.25], [2.75, 27.25], [3.5, 27.25], [4.25, 26.5], [11.75, 26.5], [12, 26.25], [24, 26.25], [24.5, 26.75], [24.5, 27.25], [25.25, 27.8]]
track +34V top w=0.5 pts=[[35.53, 3.4], [35, 4.5], [33.25, 4.5], [32.25, 5.5], [25.25, 5.5], [24.5, 4.7]]
track +34V top w=0.5 pts=[[24.5, 4.7], [23.75, 6.5], [23.25, 6.5], [23, 6.75]]
track +34V in1 w=0.5 pts=[[23, 6.75], [23, 7.25], [19.75, 10.5], [19.75, 10.75]]
track +34V top w=0.5 pts=[[19.75, 10.75], [19, 10.75], [18.5, 10.9]]
track +34V top w=0.5
  pts=[[24.5, 4.7], [23.75, 2.75], [17.75, 2.75], [17.25, 3.25], [17.25, 3.5], [16.5, 4.25], [15.75, 4.8]]
track +34V top w=0.5 pts=[[15.75, 4.8], [15, 4.25], [13.25, 4.25], [13, 4], [12, 2.85]]
track +34V top w=0.5
  pts=[[19.75, 10.75], [22.25, 13.25], [22.25, 13.5], [23, 14.25], [27.75, 14.25], [30.75, 17.25], [31.5, 17.25], [32, 17.7]]
track +34V top w=0.5 pts=[[32, 17.7], [32.25, 18], [32.25, 19.5], [32.5, 20.4]]
track +12V top w=1.8 pts=[[19.4, 34.47], [20.25, 34], [20.25, 28.75], [21.3, 28]]
track +12V top w=1.05 pts=[[21.3, 28], [19.5, 27.75], [18.75, 27.75]]
track +12V in1 w=1.05 pts=[[18.75, 27.75], [18.75, 23.25]]
track +12V top w=1.05 pts=[[18.75, 23.25], [18.75, 22.5], [19.2, 21.75]]
track +12V top w=2.2 pts=[[19.2, 21.75], [19.75, 21], [21.85, 21]]
track +12V top w=1.7
  pts=[[21.85, 21], [23, 22], [29.25, 28.25], [29.25, 30.25], [29.5, 30.5], [29.5, 30.75], [30, 31.25], [30.25, 31.25], [30.5, 31.5], [31.75, 31.5], [32.5, 32.1]]
track +12V top w=1.7 pts=[[32.5, 32.1], [33.25, 33], [33.5, 33.25], [33.5, 33.75], [34.5, 34.75], [35.6, 35.5]]
track +12V top w=1.7
  pts=[[32.5, 32.1], [33.25, 31], [36, 31], [37, 30], [37.25, 30], [37.75, 29.5], [39.75, 29.5], [41.25, 28], [42, 26.9]]
track +12V top w=1.7 pts=[[42, 26.9], [42.5, 26], [42.5, 23.75], [43.4, 23]]
track +12V top w=1.6 pts=[[43.4, 23], [44.5, 22.25], [44.75, 22], [44.75, 18.75], [45, 18.5], [45.23, 17.75]]
track +12V top w=0.9 pts=[[45.23, 17.75], [45, 17], [45, 13.5], [44.7, 13]]
track +12V top w=1.7 pts=[[42, 26.9], [42.75, 28], [45, 28]]
track +12V in2 w=1.7 pts=[[45, 28], [45.75, 28], [53.5, 35.75]]
track +12V top w=1.7 pts=[[53.5, 35.75], [54, 36.25], [55.1, 37]]
track +12V top w=1.7
  pts=[[55.1, 37], [56, 37.75], [56, 38.75], [56.75, 39.5], [61.25, 39.5], [62.25, 38.5], [63, 37.6]]
track B36_A top w=0.25 pts=[[54.75, 47.2], [54.5, 47], [53.25, 47], [52.8, 47.25]]
track B37_A top w=0.25 pts=[[52.7, 52.75], [51, 52.75], [50.75, 52.8]]
track B38_A top w=0.25
  pts=[[38.75, 32.8], [39, 33.25], [39.75, 34], [39.75, 35.5], [39.5, 35.75], [39.25, 35.75], [39, 36], [38.75, 36.3]]
track ISO_CAN_TX top w=0.25 pts=[[16.595, 54.15], [16.75, 55], [16.75, 57], [16.845, 57.55]]
track ISO_CAN_RX top w=0.25 pts=[[20.405, 54.15], [20.25, 55], [19.75, 55.5], [19.25, 55.5], [19, 55.75]]
track ISO_CAN_RX in2 w=0.25 pts=[[19, 55.75], [19.25, 55.75], [20.25, 56.75], [21, 56.75], [21.5, 57.25]]
track ISO_CAN_RX top w=0.25 pts=[[21.5, 57.25], [20.75, 57.25], [20.655, 57.55]]
track LED_WARN top w=0.2 pts=[[54.3, 52.75], [54.75, 52.5], [55, 52.5], [55.25, 52.25]]
track LED_WARN in2 w=0.2 pts=[[55.25, 52.25], [55.75, 51.75], [60, 51.75], [60.25, 52]]
track LED_WARN top w=0.2 pts=[[60.25, 52], [57.5, 52]]
track B19_GATE top w=0.25 pts=[[32.7, 44.75], [33, 44.5], [33, 43.25], [32.7, 42.85]]
track B19_GATE top w=0.25 pts=[[32.7, 42.85], [33, 42.75], [34.5, 42.75], [34.75, 42.8]]
track B16_AMP top w=0.25
  pts=[[59.7, 62.8], [60, 62.5], [60.25, 62.5], [61, 61.75], [63, 61.75], [63.5, 62.25], [63.75, 62.7]]
track B2_GATE top w=0.25 pts=[[19.4, 39.03], [18.5, 38.5], [18.25, 38.25], [18.25, 38], [17.5, 37.25], [17.25, 36.8]]
track B39_GATE top w=0.25 pts=[[52.75, 69.3], [52.5, 69.5], [51, 69.5], [50.7, 69.85]]
track B39_GATE top w=0.25 pts=[[50.7, 69.85], [50.5, 70.25], [50.5, 71.5], [50.3, 71.75]]
track B16_SP top w=0.25 pts=[[60.2, 66.75], [59.75, 66.5], [59.75, 65], [59.7, 64.7]]
track B16_SP top w=0.25 pts=[[60.2, 66.75], [60.5, 67], [60.5, 68], [61, 68.5], [61.3, 68.75]]
track B13_A top w=0.25 pts=[[53.615, 5.55], [53.75, 6.25], [54.25, 6.75]]
track B13_A in2 w=0.25 pts=[[54.25, 6.75], [57.25, 6.75]]
track B13_A top w=0.25 pts=[[57.25, 6.75], [58.3, 6.75]]
track B27_CANH_IC top w=0.25
  pts=[[18.115, 62.95], [18, 62.25], [17.5, 61.75], [16, 61.75], [15.75, 62], [15.75, 62.5], [15.5, 62.75], [13.25, 62.75], [12.65, 62.25]]
track B16_SN top w=0.25 pts=[[57.75, 66.7], [57.5, 66.25], [57.5, 65], [57.3, 64.7]]
track B16_SN top w=0.25
  pts=[[57.75, 66.7], [58, 67], [58.75, 67], [59, 67.25], [59, 68], [59.25, 68.25], [59.25, 68.5], [59.7, 68.75]]
track NTC1 top w=0.25
  pts=[[40.7, 41.25], [40.25, 41], [40, 40.75], [40, 39.75], [39.5, 39.25], [38, 39.25], [38, 39], [37.5, 38.5], [37.2, 38.25]]
track B21_GATE top w=0.25 pts=[[51.2, 29.75], [49.5, 29.75], [49.2, 29.85]]
track B21_GATE top w=0.25 pts=[[49.2, 29.85], [49.25, 29.5], [49.25, 26], [48.8, 25.75]]
track B23_GATE top w=0.25 pts=[[48.25, 36.2], [48, 35.75], [48, 34.5], [48.15, 34.2]]
track B23_GATE top w=0.25
  pts=[[48.15, 34.2], [48.5, 34], [48.75, 33.75], [48.75, 33.25], [49.5, 32.5], [49.75, 32.5], [50, 32.25], [51, 32.25], [51.25, 32.5], [51.25, 33], [51.5, 33.25], [51.75, 33.25], [52, 33.5], [52.25, 33.8]]
track B24_GATE top w=0.25
  pts=[[57.75, 36.2], [57.5, 35.75], [57.25, 35.5], [57.25, 35.25], [56.5, 34.5], [56.15, 34.2]]
track B24_GATE top w=0.25
  pts=[[56.15, 34.2], [56.5, 34], [56.75, 33.75], [56.75, 33.25], [57.5, 32.5], [59.25, 32.5], [59.25, 33], [59.5, 33], [59.5, 33.25], [59.75, 33.25], [60, 33.5], [60.25, 33.8]]
track B20_GATE top w=0.25 pts=[[44.75, 37.8], [44.5, 38.25], [43, 38.25], [42.7, 37.85]]
track B20_GATE top w=0.25
  pts=[[42.7, 37.85], [42.5, 37.5], [42, 37.5], [41, 36.5], [41, 34.75], [41.5, 34.75], [41.5, 34.5], [41.75, 34.5], [41.75, 34.25], [42, 34], [42.3, 33.75]]
track SWCLK bottom w=0.2
  pts=[[64.98, 44.865], [64.75, 44.5], [64.25, 44], [63, 44], [62.75, 44.25], [62.75, 47.5], [65.25, 50]]
track SWCLK top w=0.2 pts=[[65.25, 50], [65.25, 50.5], [66, 50.5]]
track B13_B top w=0.25 pts=[[54.885, 5.55], [55, 6.25], [57.75, 9], [58.3, 9.75]]
track B27_CANL_IC top w=0.25
  pts=[[19.385, 62.95], [19.25, 63.5], [19, 63.75], [19, 64], [18.75, 64.25], [12.65, 64.25]]
track B27_TERM top w=0.25 pts=[[23.25, 61.3], [24, 60.75], [24.25, 60.5], [24.25, 60], [24.5, 59.75], [24.75, 59.3]]
track B27_TERM top w=0.25 pts=[[23.25, 61.3], [22.5, 60.75], [20.5, 60.75]]
track B27_TERM in2 w=0.25 pts=[[20.5, 60.75], [17.75, 60.75], [15.75, 58.75]]
track B27_TERM top w=0.25 pts=[[15.75, 58.75], [15.5, 58.75], [15.25, 58.5], [14.7, 57.75]]
track ISO_UART_TX top w=0.25 pts=[[57.85, 22.095], [57, 22], [56.25, 21.25]]
track ISO_UART_TX in1 w=0.25
  pts=[[56.25, 21.25], [56.25, 16.5], [53.75, 14], [53.75, 13.5], [53.5, 13.25], [53.5, 12.75], [53, 12.25]]
track ISO_UART_TX top w=0.25 pts=[[53, 12.25], [52.5, 11.75], [52.5, 11.5], [52.345, 10.95]]
track ISO_UART_RX top w=0.25 pts=[[57.85, 25.905], [57, 25.75], [56.75, 25.75], [56.5, 25.5]]
track ISO_UART_RX in1 w=0.25 pts=[[56.5, 25.5], [56.5, 22.25], [57, 21.75], [57, 12.25], [56.75, 12]]
track ISO_UART_RX top w=0.25 pts=[[56.75, 12], [56.25, 11.5], [56.155, 10.95]]
track B4_GATE top w=0.25 pts=[[30.97, 3.4], [30.5, 4.25], [26.5, 4.25]]
track B4_GATE in2 w=0.25 pts=[[26.5, 4.25], [19.75, 4.25]]
track B4_GATE top w=0.25 pts=[[19.75, 4.25], [19, 4.25], [18.75, 4.2]]
track B4_GATE top w=0.25 pts=[[19.75, 4.25], [19.75, 4.5], [20, 4.75], [20, 7], [19.75, 7.25], [19, 7.25], [18.5, 7.6]]
track PRES_IN top w=0.25 pts=[[26.8, 72], [26.5, 72.5], [12.5, 72.5], [11.25, 73.75], [10.75, 73.95]]
track B32_OSC_OUT top w=0.25 pts=[[62, 57.5], [62, 56.25], [62.25, 56.25], [63, 55.5], [64.5, 55.5]]
track B32_OSC_OUT in2 w=0.25 pts=[[64.5, 55.5], [66.5, 55.5], [71.5, 50.5]]
track B32_OSC_OUT top w=0.25 pts=[[71.5, 50.5], [72, 50], [72.45, 49.4]]
track B32_OSC_OUT top w=0.25 pts=[[72.45, 49.4], [72, 48.75], [72, 47.5], [72.2, 47.25]]
track WAKE_IN top w=0.25 pts=[[27, 64.7], [26.5, 65], [24.75, 65], [24.5, 65.25], [23.75, 65.25], [23.5, 65.5]]
track WAKE_IN bottom w=0.25 pts=[[23.5, 65.5], [15.25, 73.75], [14.75, 73.95]]
track RS485_A top w=0.25 pts=[[61.2, 6.75], [60.75, 6], [60.75, 5.75], [60.5, 5.5]]
track RS485_A bottom w=0.25 pts=[[60.5, 5.5], [60.5, 2.25]]
track RS485_A top w=0.25 pts=[[60.5, 2.25], [61, 2.25], [61.35, 2.3]]
track RS485_A top w=0.25 pts=[[61.35, 2.3], [61.75, 2.25], [65.75, 2.25]]
track RS485_A top w=0.25 pts=[[60.5, 2.25], [51.75, 2.25], [51.2, 2.75]]
track RS485_A top w=0.25 pts=[[51.2, 2.75], [50.75, 3.5], [49.75, 3.5], [48.5, 4.75], [48.25, 5.2]]
track ISO_RS485_DE top w=0.25 pts=[[57.85, 23.365], [57, 23.25], [55.5, 21.75]]
track ISO_RS485_DE bottom w=0.25 pts=[[55.5, 21.75], [55.5, 12.25]]
track ISO_RS485_DE top w=0.25 pts=[[55.5, 12.25], [55, 11.75], [55, 11.5], [54.885, 10.95]]
track ISO_RS485_DE top w=0.25 pts=[[54.885, 10.95], [54.75, 10.25], [53.75, 10.25], [53.615, 10.95]]
track ISO_RS485_DE top w=0.25
  pts=[[53.615, 10.95], [53.5, 10.25], [53, 9.75], [51.5, 9.75], [50.5, 8.75], [50.25, 8.3]]
track ACK_IN top w=0.25
  pts=[[33.3, 71.5], [33, 72], [32.25, 72], [31.5, 72.75], [30, 72.75], [29.5, 73.25], [23.5, 73.25], [21.75, 75], [10, 75], [9.25, 74.25], [8.75, 73.95]]
track CAN_H top w=0.25 pts=[[8.85, 62.25], [8.25, 62], [7.25, 62], [6.85, 62.3]]
track CAN_H top w=0.25 pts=[[8.85, 62.25], [9.25, 62.75], [11.75, 65.25], [22, 65.25], [22.5, 64.75], [23.25, 64.2]]
track CAN_H in1 w=0.25 pts=[[20.5, 65.25], [20.5, 73.5], [20.75, 73.95]]
track CAN_L top w=0.25 pts=[[8.85, 64.25], [8.25, 64], [7.25, 64], [6.85, 64.2]]
track CAN_L top w=0.25
  pts=[[6.85, 64.2], [6.5, 64], [6.5, 63.5], [6, 63], [6, 61.5], [7.75, 61.5], [8, 61.25], [8.5, 61.25], [11.25, 58.5], [11.8, 57.75]]
track CAN_L top w=0.25 pts=[[8.85, 64.25], [9.25, 64.75], [11, 66.5]]
track CAN_L in2 w=0.25 pts=[[11, 66.5], [18.25, 73.75], [18.75, 73.95]]
track RS485_B top w=0.25
  pts=[[61.2, 9.75], [61.75, 9], [61.75, 8.5], [62.25, 8], [62.25, 5], [61.75, 4.5], [61.35, 4.2]]
track RS485_B top w=0.25 pts=[[62.25, 5], [65.25, 5], [65.75, 4.5]]
track RS485_B in2 w=0.25 pts=[[65.75, 4.5], [67.5, 2.75], [67.75, 2.25]]
track RS485_B top w=0.25
  pts=[[67.75, 2.25], [67.5, 1.75], [67.25, 1.75], [66.75, 1.25], [49.5, 1.25], [48.75, 2], [48.3, 2.75]]
track RS485_B top w=0.25 pts=[[48.3, 2.75], [46.5, 2.75], [46.25, 3.2]]
track ENABLE_IN top w=0.25
  pts=[[33.3, 64.5], [33, 65], [29.5, 65], [29.25, 65.25], [28.5, 65.25], [28, 65.75], [24.5, 65.75], [24, 66.25], [21, 66.25], [19, 68.25], [18.75, 68.25], [15.25, 71.75]]
track ENABLE_IN in1 w=0.25 pts=[[15.25, 71.75], [13.25, 73.75], [12.75, 73.95]]
track DOUT2 top w=0.2 pts=[[52.8, 29.75], [53.25, 30], [53.75, 30.5]]
track DOUT2 bottom w=0.2
  pts=[[53.75, 30.5], [53.75, 34.5], [54.25, 35], [54.25, 40.25], [63.75, 49.75], [63.75, 51], [64.25, 51.5], [64.25, 52.5]]
track DOUT2 top w=0.2 pts=[[64.25, 52.5], [66, 52.5]]
track AIN3 top w=0.25
  pts=[[38.8, 38.25], [38.5, 38], [38.5, 37.75], [38, 37.25], [36.5, 37.25], [36.25, 37.5], [36.25, 39], [36.5, 39.25], [37, 39.25], [37.5, 39.75], [38.5, 39.75], [38.75, 40.2]]
track AIN3 top w=0.2 pts=[[38.8, 38.25], [39.25, 38.5], [39.75, 38.5], [40.5, 39.25]]
track AIN3 bottom w=0.2 pts=[[40.5, 39.25], [45.75, 44.5], [45.75, 45], [56.5, 55.75], [56.5, 56.25], [56.75, 56.5]]
track AIN3 top w=0.2 pts=[[56.75, 56.5], [56.75, 56], [57.5, 56]]
track DIN4 top w=0.25 pts=[[35.2, 71.5], [35, 71], [35, 69.5], [34.8, 69.25]]
track DIN4 top w=0.25 pts=[[34.8, 69.25], [35.25, 69], [37, 69], [37.25, 69.2]]
track DIN4 top w=0.25 pts=[[37.25, 69.2], [37, 68.75], [36.75, 68.5], [36.75, 67.5], [36.4, 67]]
track DIN4 top w=0.2 pts=[[36.4, 67], [36.75, 66.5], [39.75, 66.5], [40.25, 66]]
track DIN4 in2 w=0.2
  pts=[[40.25, 66], [54.75, 51.5], [55, 51.5], [55.25, 51.25], [58, 51.25], [59, 50.25], [59.5, 50.25]]
track DIN4 top w=0.2 pts=[[59.5, 50.25], [59.5, 49]]
track +5V_ISO top w=0.5 pts=[[50.31, 17.75], [50, 17], [50, 13.5], [50.2, 13]]
track +5V_ISO top w=0.5 pts=[[50.2, 13], [50.5, 12.5], [50.5, 11], [50.2, 10.5]]
track +5V_ISO bottom w=0.5 pts=[[50.31, 17.75], [50, 17], [50, 8.5], [49.5, 8], [49.5, 5.5]]
track +5V_ISO top w=0.5 pts=[[49.5, 5.5], [49.25, 5.75], [49.25, 6.25], [48.75, 6.25], [48.5, 6.5], [48.25, 6.8]]
track +5V_ISO top w=0.5 pts=[[50.31, 17.75], [51, 17.5], [57.25, 17.5], [57.7, 17.25]]
track +5V_ISO top w=0.5 pts=[[57.7, 17.25], [57.5, 17.5], [57.5, 19.5], [57.85, 19.555]]
track +5V_ISO bottom w=0.5 pts=[[50, 8.5], [55, 3.5], [55.5, 3.5], [55.75, 3.25]]
track +5V_ISO top w=0.5 pts=[[55.75, 3.25], [54.8, 3.25]]
track +5V_ISO bottom w=0.5 pts=[[55.5, 3.5], [57, 5]]
track +5V_ISO top w=0.5 pts=[[57, 5], [56.25, 5], [56.155, 5.55]]
track +5V_ISO bottom w=0.5 pts=[[50.31, 17.75], [50.5, 18.5], [50.5, 20.5], [51, 21], [51, 21.5]]
track +5V_ISO top w=0.5 pts=[[51, 21.5], [56.25, 26.75], [56.75, 26.75], [57, 27], [57.85, 27.175]]
track +5V_ISO bottom w=0.5
  pts=[[57, 5], [58.25, 5], [59.75, 6.5], [61.5, 6.5], [62.5, 5.5], [66, 5.5], [66.25, 5.25], [66.5, 5.25], [68.5, 3.25], [68.75, 3.25], [68.75, 3], [69.25, 2.5], [69.75, 2.25]]
track RS485_DE top w=0.2 pts=[[67.15, 23.365], [66.25, 23.5], [65.5, 24.25]]
track RS485_DE in1 w=0.2
  pts=[[65.5, 24.25], [65.5, 41.5], [62.75, 44.25], [62.75, 47.25], [60.25, 49.75], [60.25, 50.75], [59.5, 51.5], [59.5, 51.75], [58.75, 52.5], [58.75, 53]]
track RS485_DE top w=0.2 pts=[[58.75, 53], [57.5, 53]]
track RESET_N top w=0.25 pts=[[72.85, 28.7], [72.5, 29], [72, 29.5]]
track RESET_N bottom w=0.25 pts=[[72, 29.5], [72, 41.5], [69, 44.5], [68.79, 44.865]]
track RESET_N in1 w=0.25
  pts=[[68.79, 44.865], [69.25, 45], [69.75, 45.5], [69.75, 47.75], [70.5, 48.5], [70.5, 51], [71.25, 51.75]]
track RESET_N top w=0.25 pts=[[71.25, 51.75], [71, 51.75], [70.5, 51.25], [70.25, 50.8]]
track RESET_N top w=0.25
  pts=[[71.25, 51.75], [71.5, 52], [71.5, 52.75], [73.5, 52.75], [73.75, 53], [73.75, 56], [73.5, 56.25], [73, 56.25], [72.75, 56.5], [72.75, 59.5], [72.5, 59.75], [72.25, 59.75], [72, 60], [71.75, 60.3]]
track RESET_N in1 w=0.2
  pts=[[70.5, 51], [70.25, 51.25], [69, 51.25], [68, 52.25], [67.25, 52.25], [65, 54.5], [64.75, 54.5]]
track RESET_N top w=0.2
  pts=[[64.75, 54.5], [63.75, 54.5], [63.25, 55], [62.5, 55], [61.75, 55.75], [61.5, 55.75], [61.5, 57.5]]
track B6_FB top w=0.25 pts=[[29.3, 49.2], [29, 48.75], [28.75, 48.5]]
track B6_FB in1 w=0.25 pts=[[28.75, 48.5], [28.75, 43.75]]
track B6_FB top w=0.25 pts=[[28.75, 43.75], [28.75, 44.5], [29.2, 44.75]]
track B6_FB top w=0.25
  pts=[[29.3, 49.2], [29.5, 49.5], [29.5, 50.5], [29.75, 50.75], [29.75, 53.75], [29.5, 54], [28.25, 54], [27.5, 54.75], [27.5, 55], [27.2, 55.25]]
track +5V top w=0.5 pts=[[36.5, 48.25], [36, 49.75], [36, 51.25], [36.25, 51.8]]
track +5V top w=0.5 pts=[[36.5, 48.25], [37, 47.5], [39.25, 47.5], [40.35, 47.7]]
track +5V top w=0.5 pts=[[40.35, 47.7], [39.25, 47.25], [39.25, 45.5], [39.7, 45.25]]
track +5V top w=0.5
  pts=[[36.25, 51.8], [35.5, 52.25], [35.25, 52.5], [35.25, 53.25], [34.25, 54.25], [34.25, 54.5], [33.7, 55.25]]
track +5V top w=0.5
  pts=[[33.7, 55.25], [33.25, 56], [32.5, 56], [31.75, 56.75], [29.75, 56.75], [29.75, 56.5], [29.5, 56.25], [29.5, 55.75], [29.25, 55.5], [28.8, 55.25]]
track +5V top w=0.5
  pts=[[33.7, 55.25], [34.25, 56], [34.5, 56], [37.25, 58.75], [40, 58.75], [40.75, 59.5], [41.45, 60.25]]
track +5V top w=0.5 pts=[[41.45, 60.25], [42.25, 59.5], [47.5, 59.5], [48.25, 58.75], [52.5, 58.75], [52.75, 59.2]]
track +5V top w=0.5
  pts=[[28.8, 55.25], [28.5, 55.5], [28.25, 55.75], [28.25, 56.25], [26.25, 56.25], [26, 56], [26, 55.5], [24.75, 54.25], [24.75, 54], [23.75, 53], [23.75, 52.5], [14, 52.5], [10, 48.5], [9.25, 48.23]]
track +5V top w=0.5 pts=[[9.25, 48.23], [8.5, 48], [5, 48], [4.5, 47.7]]
track UART_TX top w=0.2 pts=[[67.15, 22.095], [66.25, 22.25], [64.75, 23.75]]
track UART_TX in1 w=0.2 pts=[[64.75, 23.75], [64.75, 40.75], [60.5, 45], [60.5, 46.5], [60, 47]]
track UART_TX top w=0.2 pts=[[60, 47], [60.25, 47], [60.5, 47.25], [61, 47.25], [61.5, 47.75], [61.5, 49]]
track I2C_SDA top w=0.2 pts=[[70.655, 36.45], [70.75, 37], [72.75, 39]]
track I2C_SDA bottom w=0.2 pts=[[72.75, 39], [72.75, 45.25], [72.5, 45.5], [72.5, 45.75], [64.75, 53.5]]
track I2C_SDA top w=0.2 pts=[[64.75, 53.5], [66, 53.5]]
track CAN_RX top w=0.2 pts=[[20.405, 44.85], [20.5, 45.75], [21, 46.25], [24, 46.25]]
track CAN_RX in2 w=0.2 pts=[[24, 46.25], [58, 46.25], [59.5, 47.75], [60.25, 47.75], [62.75, 50.25]]
track CAN_RX top w=0.2 pts=[[62.75, 50.25], [62.5, 50.25], [62.5, 49]]
track UART_RX top w=0.2
  pts=[[67.15, 25.905], [66.25, 26], [65.75, 26.5], [65.75, 27.5], [64.75, 28.5], [64.75, 31.25], [64.5, 31.5], [64.5, 37.5], [64.25, 37.75], [64.25, 39.25], [62, 41.5], [62, 49]]
track SWDIO top w=0.2
  pts=[[63.71, 44.865], [63.25, 45], [63, 45], [62.75, 45.25], [62.75, 47], [63.5, 47.75], [63.5, 49]]
track DIN2 top w=0.25 pts=[[35.2, 64.5], [35, 64], [35, 62.5], [34.8, 62.25]]
track DIN2 top w=0.25 pts=[[34.8, 62.25], [35.25, 62], [37, 62], [37.25, 62.2]]
track DIN2 in1 w=0.25 pts=[[35.75, 62], [35.75, 60.75], [35.5, 60.5]]
track DIN2 top w=0.25 pts=[[35.5, 60.5], [36, 60.5], [36.4, 60]]
track DIN2 top w=0.2 pts=[[37.25, 62.2], [37.5, 61.75], [59, 61.75], [62, 58.75], [63, 58.75], [63, 57.5]]
track LED_STATUS top w=0.2 pts=[[54.75, 48.8], [55, 49.25], [58.25, 49.25]]
track LED_STATUS in2 w=0.2
  pts=[[58.25, 49.25], [59.75, 49.25], [60.25, 49.75], [60.25, 50.75], [60.5, 51], [64.75, 51]]
track LED_STATUS top w=0.2 pts=[[64.75, 51], [66, 51]]
track LED_FAULT top w=0.2 pts=[[38.75, 31.2], [39, 31.5], [39.25, 31.5], [39.75, 32]]
track LED_FAULT in1 w=0.2 pts=[[39.75, 32], [39.75, 34.25], [44, 38.5], [44, 38.75], [55.25, 50], [55.25, 50.5]]
`;
