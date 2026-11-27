/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p, written by tools/gen_demo_bms3.mjs, from its functions to its copper, in the
   .dwiz format. Do not edit by hand : change the generator and run it again. */
export const DEMO_BMS3_2 = `  role="Haut du pont : tient la tension de l'entrée"
part R42 R-0603 value="10 kΩ 1 %" block=B29 at=[20.25, 62.5] rot=90 side=top local=R2 role="Bas du pont" near=R41
part D16 D-ZEN-SOD123 value="3,3 V" block=B29 at=[23, 62.25] rot=90 side=top local=DZ role="Écrête les surtensions"
  near=R42
part C35 C-0603 value="100 nF" block=B29 at=[23.5, 58.75] rot=0 side=top local=C
  role="Filtre les rebonds et les parasites" near=R42
part R43 R-0805 value="33 kΩ 1 %" block=B30 at=[20.5, 68.25] rot=90 side=top local=R1
  role="Haut du pont : tient la tension de l'entrée"
part R44 R-0603 value="10 kΩ 1 %" block=B30 at=[22.75, 68] rot=270 side=top local=R2 role="Bas du pont" near=R43
part D17 D-ZEN-SOD123 value="3,3 V" block=B30 at=[22.25, 71.5] rot=180 side=top local=DZ role="Écrête les surtensions"
  near=R44
part C36 C-0603 value="100 nF" block=B30 at=[23, 73.75] rot=0 side=top local=C
  role="Filtre les rebonds et les parasites" near=R44
part J5 J-WTB-8 value="" block=B31 at=[2.25, 41.75] rot=270 side=top local=J role="Liaison vers le faisceau" edge=true
  nc=[]
part U11 U-MCU-LQFP48 value="" block=B32 at=[30.25, 50.75] rot=180 side=top local=U role="Calcule, mesure et commande"
part C37 C-0603 value="100 nF" block=B32 at=[38.75, 48.5] rot=90 side=top local=CD1 role="Découplage de la broche 1"
  pin="1" near=U11
part C38 C-0603 value="100 nF" block=B32 at=[38.75, 53.5] rot=270 side=top local=CD2 role="Découplage de la broche 24"
  pin="24" near=U11
part C39 C-0603 value="100 nF" block=B32 at=[38.75, 45] rot=270 side=top local=CD3 role="Découplage de la broche 36"
  pin="36" near=U11
part C40 C-0603 value="100 nF" block=B32 at=[40.75, 45.5] rot=270 side=top local=CD4 role="Découplage de la broche 48"
  pin="48" near=U11
part C41 C-0805 value="4,7 µF" block=B32 at=[41.75, 49.5] rot=0 side=top local=CB role="Réserve locale" near=U11
part L3 FB-0603 value="600 Ω à 100 MHz" block=B32 at=[42.75, 52.5] rot=90 side=top local=FB
  role="Isole l'alimentation analogique" near=U11
part C42 C-0603 value="1 µF" block=B32 at=[39.5, 56.25] rot=0 side=top local=CA1 role="Découplage analogique" pin="9"
  near=U11
part C43 C-0603 value="10 nF" block=B32 at=[40.75, 52.5] rot=90 side=top local=CA2 role="Découplage analogique" pin="9"
  near=U11
part R45 R-0603 value="10 kΩ" block=B32 at=[42.75, 46.5] rot=90 side=top local=RR role="Rappel de la remise à zéro"
  near=U11
part C44 C-0603 value="100 nF" block=B32 at=[39.5, 58.25] rot=180 side=top local=CR role="Filtre la remise à zéro"
  near=U11
part R46 R-0603 value="10 kΩ" block=B32 at=[42.25, 56] rot=90 side=top local=RB
  role="Démarrage sur la mémoire programme" near=U11
part Y1 Y-3225 value="8 MHz" block=B32 at=[45.75, 48.5] rot=90 side=top local=Y role="Base de temps" near=U11
part C45 C-0603 value="15 pF" block=B32 at=[45.5, 45.25] rot=0 side=top local=CX1 role="Charge du quartz" near=Y1
part C46 C-0603 value="15 pF" block=B32 at=[48.75, 48.5] rot=270 side=top local=CX2 role="Charge du quartz" near=Y1
part U12 U-EEPROM-SOIC8 value="64 kbit" block=B33 at=[47.25, 41.25] rot=180 side=top local=U
  role="Mémoire non volatile"
part C47 C-0603 value="100 nF" block=B33 at=[58, 62.25] rot=0 side=top local=C role=Découplage near=U12
part J6 J-SWD-2x05 value="" block=B34 at=[54, 38.75] rot=90 side=top local=J
  role="Liaison avec la sonde de programmation" nc=["6", "7", "8"]
part TP1 TP-1.0 value=VSYS block=B35 at=[46.25, 29.75] rot=0 side=top local=TP1 role="Accès de mesure à VSYS"
part TP2 TP-1.0 value=+3V3 block=B35 at=[51.75, 29.75] rot=0 side=top local=TP2 role="Accès de mesure à +3V3"
part TP3 TP-1.0 value=GND block=B35 at=[40.75, 32.25] rot=0 side=top local=TP3 role="Accès de mesure à GND"
part TP4 TP-1.0 value=GND_ISO block=B35 at=[48.25, 29.75] rot=0 side=top local=TP4 role="Accès de mesure à GND_ISO"
part TP5 TP-1.0 value=GND_CISO block=B35 at=[45.25, 33.25] rot=0 side=top local=TP5 role="Accès de mesure à GND_CISO"
part FID1 FID-1.0 value="" block=B35 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B35 at=[73.25, 3] rot=0 side=top local=FID2 role="Repère optique de placement"
  corner=2
part FID3 FID-1.0 value="" block=B35 at=[3, 73.2] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
part D18 LED-0603 value=verte block=B36 at=[45.75, 36.5] rot=270 side=top local=D role=Témoin
part R47 R-0603 value="680 Ω" block=B36 at=[43.75, 36.5] rot=270 side=top local=R role="Fixe le courant" near=D18
part D19 LED-0603 value=jaune block=B37 at=[37.5, 36.25] rot=180 side=top local=D role=Témoin
part R48 R-0603 value="680 Ω" block=B37 at=[36.5, 34.25] rot=0 side=top local=R role="Fixe le courant" near=D19
part D20 LED-0603 value=rouge block=B38 at=[49.5, 37.25] rot=180 side=top local=D role=Témoin
part R49 R-0603 value="680 Ω" block=B38 at=[49.5, 35.25] rot=180 side=top local=R role="Fixe le courant" near=D20
part BZ1 BZ-12 value="" block=B39 at=[65.25, 43.25] rot=90 side=top local=BZ role="Avertisseur piézo"
part Q8 Q-NMOS-SOT23 value="" block=B39 at=[65.25, 51.75] rot=270 side=top local=Q role="Commute l'avertisseur"
  near=BZ1
part R50 R-0603 value="1 kΩ" block=B39 at=[65.5, 35.75] rot=0 side=top local=RD
  role="Décharge la capacité du piézo à chaque période" near=BZ1
part R51 R-0603 value="100 Ω" block=B39 at=[61.5, 52.75] rot=0 side=top local=RG role="Limite le courant de grille"
  near=Q8
part R52 R-0603 value="100 kΩ" block=B39 at=[68.25, 52.5] rot=270 side=top local=RPD
  role="Silence pendant le démarrage" near=Q8
net +12V_IN class=power voltage=12 current=6 pins=[J1.1, F1.1]
net GND class=ground voltage=0 current=6
  pins=[J1.2, R1.2, D1.A, C1.-, C2.2, J2.2, R2.2, D3.A, C3.-, C4.2, C5.2, U1.GND, C6.2, C7.2, C8.2, C9.2, R4.2, U2.GND, C11.2, C12.2, U3.GND, C13.2, R7.2, D6.A, C14.2, R9.2, C15.2, U4.GND1, C16.2, U5.GND1, C18.2, U5.INC, J4.5, U7.GND, C21.2, C23.2, R21.2, C24.2, C25.2, Q3.S, R25.2, Q4.S, R27.2, Q5.S, R29.2, R31.2, D11.A, C26.2, Q6.S, R33.2, Q7.S, R35.2, U8.GND1, C27.2, U9.GND1, C29.2, U9.INC, U9.INB, R40.2, D15.A, C34.2, R42.2, D16.A, C35.2, R44.2, D17.A, C36.2, J5.8, U11.VSS, U11.VSSA, C41.2, C42.2, C43.2, C44.2, R46.2, C37.2, C38.2, C39.2, C40.2, Y1.GND, C45.2, C46.2, U12.GND, U12.A0, U12.A1, U12.A2, U12.WP, C47.2, J6.3, J6.5, J6.9, TP3.TP, D18.K, D19.K, D20.K, Q8.S, R52.2]
net B2_FUSED class=power voltage=12 current=6 pins=[F1.2, Q1.D]
net +12V class=power voltage=12 current=6 pins=[Q1.S, D1.K, C1.+, C2.1, D5.A, D8.K, D9.K, D10.K, D12.K, D13.K]
net B2_GATE class=signal voltage=12 current=0 pins=[Q1.G, R1.1]
net +34V_IN class=power voltage=34 current=1 pins=[J2.1, F2.1]
net B4_FUSED class=power voltage=34 current=1 pins=[F2.2, Q2.D]
net +34V class=power voltage=34 current=1 pins=[Q2.S, D3.K, C3.+, C4.1, D2.K, D4.A, R8.1]
net B4_GATE class=signal voltage=34 current=0 pins=[Q2.G, R2.1, D2.A]
net VSYS class=power voltage=34 current=0.5 pins=[D4.K, D5.K, C5.1, U1.VIN, C6.1, C7.1, R5.1, TP1.TP]
net B6_SW class=power voltage=34 current=1 pins=[U1.SW, L1.1, C10.2]
net B6_BST class=signal voltage=34 current=0 pins=[U1.BST, C10.1]
net +5V class=power voltage=5 current=1
  pins=[L1.2, C8.1, C9.1, R3.1, U2.VIN, C11.1, U4.VIN, C16.1, U8.VIN, C27.1, BZ1.+, R50.1]
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
track GND_ISO top w=0.5 pts=[[46.77, 9.25], [47, 8.5], [47, 5], [47.3, 4.5]]
track GND_ISO top w=0.5
  pts=[[46.77, 9.25], [47.25, 9.75], [47.5, 9.75], [50.25, 12.5], [52.5, 12.5], [53, 13], [53.055, 13.85]]
track GND_ISO top w=0.5
  pts=[[53.055, 13.85], [53.25, 14.75], [53.5, 15], [53.5, 15.25], [53.75, 15.5], [60, 15.5], [60.5, 15], [60.5, 14.75], [60.675, 13.85]]
track GND_ISO top w=0.5 pts=[[60.675, 13.85], [60.75, 13], [61, 12.75], [61, 11.75], [61.25, 11.35]]
track GND_ISO top w=0.5 pts=[[60.5, 15], [60.75, 15], [63.25, 17.5], [64, 17.5], [64.25, 17.8]]
track GND_ISO top w=0.5 pts=[[47, 5.75], [40.75, 5.75], [40, 5], [39.5, 4.7]]
track GND_ISO top w=0.5
  pts=[[61.25, 11.35], [61.5, 11], [62.25, 11], [63, 10.25], [63, 10], [63.25, 9.75], [63.25, 9.5], [68.25, 9.5], [69, 8.75], [69.25, 8.3]]
track GND_ISO top w=0.5 pts=[[68.25, 9.5], [68.5, 9.5], [69.25, 10.25], [69.95, 10.345]]
track GND_ISO top w=0.5 pts=[[69.95, 10.345], [70.5, 10.5], [71.75, 10.5], [72, 10.75], [72.25, 11.2]]
track GND_ISO top w=0.5
  pts=[[72.25, 11.2], [72.5, 10.75], [72.75, 10.75], [73.25, 10.25], [73.25, 9.75], [73.5, 9.5], [73.8, 9.25]]
track GND_ISO top w=0.5
  pts=[[69.25, 8.3], [69.5, 8], [70, 8], [70.25, 7.75], [70.25, 5.75], [70, 5.5], [69.75, 5.5], [67, 2.75], [66.75, 2.25]]
track GND_ISO top w=0.5
  pts=[[53.75, 15.5], [53.5, 15.75], [53.5, 17], [52.5, 18], [52.5, 20.25], [51.75, 21], [51.75, 24.25], [48.75, 27.25], [48.75, 28], [48.25, 28.5], [48.25, 29.75]]
track PUMP_OUT top w=0.78 pts=[[35.15, 39.25], [34.75, 39.5], [33.5, 39.5], [32.6, 39]]
track CONTACTEUR_OUT top w=0.5 pts=[[8.35, 40.25], [8.75, 40], [10, 40], [10.9, 39.5]]
track PRECHARGE_OUT top w=0.5 pts=[[13.35, 43.75], [13, 44], [13, 46.75], [12.9, 47.5]]
track FAN_OUT top w=0.5 pts=[[25.85, 40.25], [26.25, 40.5], [27.5, 41.75], [28.4, 42.5]]
track B2_FUSED top w=3.56 pts=[[25.25, 30.7], [26, 31.25], [27.75, 31.25], [30.75, 29.9]]
track PYRO_OUT top w=0.78 pts=[[4.15, 54.75], [4.25, 54.5], [4.25, 54]]
track PYRO_OUT in2 w=0.78 pts=[[4.25, 54], [9.25, 54], [9.5, 54.25]]
track PYRO_OUT top w=0.78 pts=[[9.5, 54.25], [10, 53.75], [10.9, 53]]
track VOUT_TAP top w=0.5 pts=[[73.95, 68.75], [64.5, 68.75], [64.2, 68.5]]
track +34V_IN top w=0.5 pts=[[3.5, 13.5], [4.5, 12.5], [11.75, 12.5], [12.75, 11.5], [13.3, 10.75]]
track SHUNT_P bottom w=0.5
  pts=[[73.95, 72.75], [73.5, 72.25], [73, 72.25], [72.5, 71.75], [72.5, 71.5], [72.25, 71.25], [72.25, 65], [69.5, 62.25]]
track SHUNT_P top w=0.5 pts=[[69.5, 62.25], [69, 61.75], [68.75, 61.3]]
track SHUNT_N in1 w=0.5
  pts=[[73.95, 70.75], [73.5, 70.5], [73.25, 70.25], [73, 70.25], [72.5, 69.75], [72.5, 69.5], [72.25, 69.25], [72.25, 69], [70.75, 67.5], [70.75, 65.75], [70.25, 65.25]]
track SHUNT_N top w=0.5 pts=[[70.25, 65.25], [67, 62], [67, 61.75], [66.75, 61.3]]
track B4_FUSED top w=0.5 pts=[[16.2, 10.75], [16.75, 11.25], [22, 11.25]]
track B4_FUSED in2 w=0.5 pts=[[22, 11.25], [29, 11.25]]
track B4_FUSED top w=0.5 pts=[[29, 11.25], [29.75, 11.25], [32.75, 10.1]]
track +12V_IN top w=1.05
  pts=[[1.75, 28.25], [2.75, 29.25], [3.5, 29.25], [4.25, 30], [11.75, 30], [12, 30.25], [17.25, 30.25], [18.5, 29], [18.5, 27], [18.75, 26.75], [24, 26.75], [24.5, 27.25], [25.25, 27.8]]
track VSYS top w=0.5 pts=[[31.4, 20.5], [31.25, 21.25], [31.25, 23.25], [31.4, 24]]
track VSYS top w=0.5
  pts=[[31.4, 24], [32.5, 24.75], [32.75, 24.75], [33.75, 25.75], [34, 25.75], [34.25, 26], [35.25, 26], [35.5, 26.25], [36.25, 26.8]]
track VSYS top w=0.5 pts=[[31.4, 20.5], [32.5, 19.75], [33.25, 19.75]]
track VSYS in2 w=0.5 pts=[[33.25, 19.75], [37.75, 19.75], [38, 19.5]]
track VSYS top w=0.5 pts=[[38, 19.5], [38.25, 19.5], [38.5, 19.25], [39, 19.25], [39.25, 19.2]]
track VSYS in2 w=0.5 pts=[[38, 19.5], [46.5, 19.5], [47, 20]]
track VSYS top w=0.5 pts=[[47, 20], [47, 19.25], [47.25, 18.8]]
track VSYS in2 w=0.5 pts=[[47, 20], [47, 25.5]]
track VSYS top w=0.5 pts=[[47, 25.5], [47, 26.25], [46.5, 26.7]]
track VSYS top w=0.5 pts=[[46.5, 26.7], [46.25, 27.25], [46.25, 29.75]]
track +34V top w=0.5 pts=[[35.03, 3.9], [34.5, 5], [32.75, 5], [31.75, 6], [24.75, 6], [24, 5.2]]
track +34V top w=0.5 pts=[[24, 5.2], [23.25, 3.25], [19, 3.25], [18.75, 3], [18.4, 2.5]]
track +34V top w=0.5
  pts=[[18.4, 2.5], [18, 3], [17.5, 3], [16.75, 3.75], [16.75, 4], [16.5, 4.25], [16.5, 4.75], [15.75, 5.3]]
track +34V top w=0.5 pts=[[15.75, 5.3], [15, 4.75], [13.25, 4.75], [13, 4.5], [12, 3.35]]
track +34V top w=0.5
  pts=[[35.03, 3.9], [35.5, 5], [35.5, 5.25], [36.75, 6.5], [36.75, 16.75], [36.25, 17.25], [35.5, 17.25], [35, 17.7]]
track +34V top w=0.5 pts=[[35, 17.7], [35.5, 18], [35.5, 19.75], [35.6, 20.5]]
track +5V_ISO top w=0.5 pts=[[49.31, 9.25], [49.5, 8.5], [49.5, 5], [49.2, 4.5]]
track +5V_ISO top w=0.5
  pts=[[49.31, 9.25], [50, 9.5], [50.75, 9.5], [51.5, 10.25], [51.75, 10.25], [54, 12.5], [54, 12.75], [54.25, 13], [54.325, 13.85]]
track +5V_ISO in2 w=0.5 pts=[[49.31, 9.25], [50, 9.5], [58.25, 9.5], [61, 12.25], [62.25, 12.25]]
track +5V_ISO top w=0.5 pts=[[62.25, 12.25], [62, 12.5], [62, 13], [61.945, 13.85]]
track +5V_ISO top w=0.5 pts=[[61.945, 13.85], [62, 14.75], [63, 14.75], [64, 15.75], [64.25, 16.2]]
track +5V_ISO top w=0.5
  pts=[[64.25, 16.2], [64.5, 15.75], [66.5, 15.75], [67.75, 14.5], [69, 14.5], [69.25, 14.25], [69.95, 14.155]]
track +5V_ISO top w=0.5 pts=[[69.95, 14.155], [70.5, 14], [71.25, 14], [72, 13.25], [72.25, 12.8]]
track +5V_ISO top w=0.5 pts=[[72.25, 12.8], [72.5, 12.5], [74, 12.5], [74.25, 12.8]]
track +5V_ISO top w=0.5
  pts=[[49.2, 4.5], [48.75, 4], [48.5, 3.75], [48.5, 3.5], [48.25, 3.25], [42.5, 3.25], [41.75, 2.5], [40, 2.5], [39.5, 2.8]]
track +5V_ISO in2 w=0.5 pts=[[58.25, 9.5], [64.5, 3.25], [64.5, 2.75], [64.75, 2.25]]
track +5V top w=0.5 pts=[[44.5, 20.25], [45, 18.75], [45, 17.25], [44.75, 16.7]]
track +5V top w=0.5
  pts=[[44.75, 16.7], [45.5, 17.25], [48.75, 17.25], [49.25, 17.75], [49.25, 19.5], [49.5, 19.75], [50.25, 20.3]]
track +5V top w=0.5 pts=[[50.25, 20.3], [50.75, 20.75], [50.75, 21.5]]
track +5V in1 w=0.5 pts=[[50.75, 21.5], [55, 25.75], [56, 25.75]]
track +5V top w=0.5 pts=[[56, 25.75], [55.25, 25.75], [54.35, 26.2]]
track +5V in1 w=0.5 pts=[[56, 25.75], [56, 28.5], [56.5, 29], [56.5, 32.25]]
track +5V top w=0.5 pts=[[56.5, 32.25], [55.75, 33], [55.3, 33.25]]
track +5V top w=0.5
  pts=[[44.75, 16.7], [45.5, 16.25], [45.75, 16.25], [46.25, 15.75], [46.25, 15.5], [46.5, 15.25], [46.5, 14], [46.25, 13.75], [46.25, 12.25], [44.5, 10.5], [44.5, 10], [44.23, 9.25]]
track +5V in1 w=0.5 pts=[[44.23, 9.25], [44.5, 8.5], [44.5, 5], [44.75, 4.75]]
track +5V top w=0.5 pts=[[44.75, 4.75], [44, 4.75], [43.7, 4.5]]
track +5V top w=0.5 pts=[[44.5, 20.25], [44, 21.75], [43.5, 22.25]]
track +5V in1 w=0.5 pts=[[43.5, 22.25], [43.5, 26], [42.75, 26.75]]
track +5V top w=0.5 pts=[[42.75, 26.75], [42.5, 27], [42.5, 27.5], [42.2, 27.75]]
track +5V top w=0.5
  pts=[[56.5, 32.25], [58.5, 32.25], [59.75, 33.5], [60, 33.5], [60.5, 34], [62.75, 34], [64.25, 35.5], [64.7, 35.75]]
track +5V top w=0.5 pts=[[64.7, 35.75], [64.75, 36], [64.75, 38.75], [65.25, 39.45]]
track +5V in1 w=0.5
  pts=[[65.25, 39.45], [64.5, 40.25], [64.5, 43.75], [63.75, 44.5], [63.75, 47.5], [58.5, 52.75], [58.5, 53], [58.25, 53.25], [58.25, 53.75], [49.75, 62.25]]
track +5V top w=0.5 pts=[[49.75, 62.25], [49.25, 62.75], [49.25, 63], [48.8, 63.5]]
track +5V top w=0.5 pts=[[48.8, 63.5], [48.5, 64], [48.5, 67.5], [48.27, 68.25]]
track B38_A top w=0.25 pts=[[48.7, 35.25], [48.5, 35.5], [48.5, 37], [48.7, 37.25]]
track NTC1 top w=0.25 pts=[[57.7, 55.75], [57.25, 56], [57.25, 57.5], [57.2, 57.75]]
track B37_A top w=0.25 pts=[[37.3, 34.25], [37, 34.5], [37, 36], [36.7, 36.25]]
track B16_SP top w=0.25 pts=[[68.75, 59.7], [69, 59.25], [69, 58], [68.7, 57.7]]
track B16_SP top w=0.25 pts=[[69, 59], [70.5, 59], [70.75, 58.7]]
track B16_AMP top w=0.15 pts=[[68.7, 55.8], [69, 56], [72.25, 56], [72.7, 55.75]]
track B27_CANH_IC top w=0.25 pts=[[34.115, 63.45], [34, 62.75], [33.5, 62.25]]
track B27_CANH_IC in2 w=0.25 pts=[[33.5, 62.25], [33.25, 62.25], [31.75, 63.75]]
track B27_CANH_IC top w=0.25 pts=[[31.75, 63.75], [31.25, 63.75], [30.65, 64.25]]
track B24_GATE top w=0.25 pts=[[21.8, 41.25], [23.25, 41.25], [23.65, 41.2]]
track B24_GATE top w=0.25
  pts=[[21.8, 41.25], [21.5, 41], [21.25, 40.75], [21.25, 40.5], [20.75, 40], [20.75, 39.75], [20.5, 39.5], [20.2, 39.25]]
track B21_GATE top w=0.25 pts=[[8.25, 53.8], [8, 53.75], [6.75, 53.75], [6.35, 53.8]]
track B21_GATE top w=0.25 pts=[[6.35, 53.8], [6.5, 53.5], [6.5, 53]]
track B21_GATE bottom w=0.25 pts=[[6.5, 53], [6.5, 52.25], [5.25, 51]]
track B21_GATE top w=0.25 pts=[[5.25, 51], [5.5, 50.75], [5.75, 50.75], [6, 50.5], [6.25, 50.2]]
track B19_GATE top w=0.25 pts=[[6.25, 43.2], [6.25, 41.5], [6.15, 41.2]]
track B19_GATE top w=0.25
  pts=[[6.25, 43.2], [6.5, 43.5], [6.75, 43.5], [7.5, 44.25], [7.75, 44.25], [8, 44.5], [8.25, 44.8]]
track B39_GATE top w=0.25 pts=[[62.3, 52.75], [62.75, 53], [63.25, 53]]
track B39_GATE in2 w=0.25 pts=[[63.25, 53], [65.5, 53]]
track B39_GATE top w=0.25 pts=[[65.5, 53], [66, 53], [66.2, 52.85]]
track B39_GATE top w=0.25 pts=[[66.2, 52.85], [66.5, 53], [68, 53], [68.25, 53.3]]
track B6_FB top w=0.25 pts=[[43.7, 25.7], [43.75, 26], [43.75, 27.5], [43.8, 27.75]]
track B6_FB top w=0.25
  pts=[[43.8, 27.75], [43.5, 28], [43.25, 28.25], [43.25, 28.5], [43, 28.75], [40.75, 28.75], [40.5, 28.5], [39.75, 28.5], [39.5, 28.25], [39.25, 27.8]]
track B16_SN top w=0.25 pts=[[66.75, 59.7], [66.5, 59.25], [66.5, 58], [66.3, 57.7]]
track B16_SN top w=0.25 pts=[[66.75, 59.7], [67, 60], [67.75, 60]]
track B16_SN in2 w=0.25 pts=[[67.75, 60], [69.75, 60]]
track B16_SN top w=0.25 pts=[[69.75, 60], [70.5, 60], [70.75, 60.3]]
track B27_CANL_IC top w=0.25 pts=[[35.385, 63.45], [35.25, 62.75], [34.75, 62.25]]
track B27_CANL_IC in2 w=0.25 pts=[[34.75, 62.25], [31.5, 65.5]]
track B27_CANL_IC top w=0.25 pts=[[31.5, 65.5], [31.25, 65.75], [30.65, 66.25]]
track B2_GATE top w=0.25 pts=[[33.03, 36.1], [32.5, 36], [30.25, 36]]
track B2_GATE in2 w=0.25 pts=[[30.25, 36], [26.75, 36]]
track B2_GATE top w=0.25 pts=[[26.75, 36], [26.25, 36], [25.8, 35.75]]
track B20_GATE top w=0.25
  pts=[[15.2, 44.75], [15.5, 44.5], [15.75, 44.25], [15.75, 44], [16.25, 43.5], [16.25, 43.25], [16.5, 43], [16.8, 42.75]]
track B20_GATE top w=0.25 pts=[[15.2, 44.75], [14, 44.75]]
track B20_GATE in2 w=0.25 pts=[[14, 44.75], [12, 44.75]]
track B20_GATE top w=0.25 pts=[[12, 44.75], [11.5, 44.75], [11.15, 44.7]]
track B13_B top w=0.25 pts=[[69.95, 12.885], [69.25, 12.75], [68.75, 12.25]]
track B13_B bottom w=0.25 pts=[[68.75, 12.25], [68.75, 9.5], [68.25, 9], [68.25, 7.75]]
track B13_B top w=0.25 pts=[[68.25, 7.75], [67.2, 7.75]]
track ISO_UART_TX top w=0.25 pts=[[59.405, 13.85], [59.5, 13], [59.75, 12.75], [59.75, 12.5]]
track ISO_UART_TX in1 w=0.25 pts=[[59.75, 12.5], [61, 11.25], [63.25, 11.25]]
track ISO_UART_TX top w=0.25
  pts=[[63.25, 11.25], [63.25, 11], [63.5, 11], [63.5, 10.75], [63.75, 10.75], [64, 10.5], [64.55, 10.345]]
track ISO_UART_RX top w=0.25 pts=[[55.595, 13.85], [55.75, 13], [56.25, 12.5], [57.5, 12.5]]
track ISO_UART_RX in2 w=0.25 pts=[[57.5, 12.5], [58.5, 12.5], [59.25, 13.25], [63, 13.25], [63.25, 13.5]]
track ISO_UART_RX top w=0.25 pts=[[63.25, 13.5], [63.5, 13.75], [63.75, 13.75], [64, 14], [64.55, 14.155]]
track B27_TERM top w=0.25 pts=[[29.2, 58.25], [29, 59], [29, 60.25], [28.75, 60.7]]
track B27_TERM in1 w=0.25 pts=[[29, 59.75], [29, 67.5]]
track B27_TERM top w=0.25 pts=[[29, 67.5], [29.25, 67.75], [29.25, 68], [29.7, 68.75]]
track B13_A top w=0.25 pts=[[69.95, 11.615], [69.25, 11.5], [66, 11.5]]
track B13_A in2 w=0.25 pts=[[66, 11.5], [64.75, 11.5], [63.75, 10.5], [60.5, 10.5]]
track B13_A top w=0.25 pts=[[60.5, 10.5], [58.75, 10.5], [58.2, 10.75]]
track RS485_B top w=0.25 pts=[[64.3, 7.75], [63.75, 7], [62.75, 7], [62.2, 6.75]]
track RS485_B top w=0.25 pts=[[64.3, 7.75], [63.75, 8.5], [62.75, 8.5], [62.5, 8.75], [62.2, 9.15]]
track RS485_B top w=0.25 pts=[[62.2, 6.75], [62.5, 6], [62.5, 2.75], [62.75, 2.25]]
track RS485_B top w=0.25 pts=[[64.3, 7.75], [64.75, 7], [65.75, 7], [66.25, 6.5], [69, 6.5], [69.25, 6.7]]
track DOUT1 top w=0.2 pts=[[16.8, 44.75], [17.25, 45], [17.75, 45]]
track DOUT1 in2 w=0.2 pts=[[17.75, 45], [26.25, 45], [29, 47.75]]
track DOUT1 top w=0.2 pts=[[29, 47.75], [29, 46.5]]
track B39_DRAIN top w=0.25 pts=[[65.25, 47.05], [65, 47.75], [65, 50.25], [65.25, 50.65]]
track B39_DRAIN top w=0.25
  pts=[[65.25, 47.05], [65.5, 46.25], [65.75, 46], [65.75, 44.75], [66.75, 43.75], [66.75, 36], [66.3, 35.75]]
track WAKE_IN top w=0.25
  pts=[[4, 57.8], [3.5, 57.5], [3.25, 57.25], [3.25, 56], [2.25, 55], [2.25, 50.75], [1.25, 49.75], [1.25, 44], [2, 43.25], [2.25, 42.75]]
track DOUT3 top w=0.2 pts=[[16.7, 50.25], [17, 50.5], [17.25, 50.75], [17.25, 51], [17.5, 51.25], [23, 51.25]]
track DOUT3 in2 w=0.2 pts=[[23, 51.25], [26.5, 51.25], [29, 53.75], [29.5, 53.75]]
track DOUT3 top w=0.2 pts=[[29.5, 53.75], [29.5, 55]]
track B4_GATE top w=0.25 pts=[[30.47, 3.9], [30, 4.5], [26, 4.5]]
track B4_GATE in2 w=0.25 pts=[[26, 4.5], [19.25, 4.5]]
track B4_GATE top w=0.25 pts=[[19.25, 4.5], [18.5, 4.5], [18.25, 4.7]]
track B4_GATE in2 w=0.25 pts=[[19.25, 4.5], [17.75, 4.5], [16, 2.75]]
track B4_GATE top w=0.25 pts=[[16, 2.75], [15.5, 2.75], [15.1, 2.5]]
track ISO_RS485_DE top w=0.25
  pts=[[58.135, 13.85], [58.25, 13], [58.5, 12.75], [58.5, 12.5], [59, 12], [59.25, 12], [59.25, 11.75]]
track ISO_RS485_DE bottom w=0.25
  pts=[[59.25, 11.75], [61.25, 11.75], [61.5, 11.5], [61.75, 11.5], [62.75, 10.5], [63.75, 10.5], [64, 10.75], [64, 12.25]]
track ISO_RS485_DE top w=0.25 pts=[[64, 12.25], [64, 12.75], [64.55, 12.885]]
track ISO_RS485_DE top w=0.25 pts=[[64, 12.25], [64, 11.75], [64.55, 11.615]]
track ISO_RS485_DE bottom w=0.25 pts=[[64, 10.75], [67.75, 7], [68.75, 7], [70.5, 8.75]]
track ISO_RS485_DE top w=0.25 pts=[[70.5, 8.75], [71.5, 8.75], [71.75, 9], [72.2, 9.25]]
track B32_BOOT0 top w=0.25 pts=[[31, 46.5], [31, 47.75], [32.75, 47.75], [33, 48]]
track B32_BOOT0 in1 w=0.25
  pts=[[33, 48], [37.25, 52.25], [37.5, 52.25], [37.75, 52.5], [38, 52.5], [38.25, 52.75], [38.5, 52.75], [41.25, 55.5]]
track B32_BOOT0 top w=0.25 pts=[[41.25, 55.5], [42, 55.5], [42.25, 55.2]]
track LED_STATUS top w=0.2 pts=[[43.75, 37.3], [43.5, 37.75], [42.75, 37.75]]
track LED_STATUS in2 w=0.2 pts=[[42.75, 37.75], [40.25, 37.75], [29.5, 48.5], [28.5, 48.5], [28, 48]]
track LED_STATUS top w=0.2 pts=[[28, 48], [28, 46.5]]
track ENABLE_IN top w=0.25 pts=[[11.5, 57.8], [11, 57.5], [10.5, 57]]
track ENABLE_IN bottom w=0.25
  pts=[[10.5, 57], [10.5, 51], [8.5, 49], [8.5, 48.75], [8.25, 48.5], [8.25, 47], [2.5, 41.25], [2.25, 40.75]]
track RS485_A top w=0.25 pts=[[55.3, 10.75], [55.75, 10], [56.75, 10], [57.25, 9.5], [60, 9.5], [60.3, 9.15]]
track RS485_A top w=0.25 pts=[[60.3, 9.15], [60, 8.75], [59.75, 8.5], [59.75, 7.5], [59.3, 6.75]]
track RS485_A top w=0.25 pts=[[59.3, 6.75], [59.75, 6], [60, 5.75], [60, 3], [60.75, 2.25]]
track RS485_A top w=0.25
  pts=[[60.75, 2.25], [61.25, 1.75], [61.5, 1.75], [62, 1.25], [67.5, 1.25], [74.75, 8.5], [74.75, 10], [74.5, 10.25], [74.5, 10.75], [74.25, 11.2]]
track AIN3 top w=0.25 pts=[[58.8, 57.75], [58.75, 58], [58.75, 59.5], [58.8, 59.75]]
track AIN3 top w=0.2 pts=[[58.8, 57.75], [58.5, 57.5], [58.25, 57.25], [58.25, 57], [58, 56.75]]
track AIN3 in2 w=0.2 pts=[[58, 56.75], [46.5, 56.75], [43.75, 54], [40, 54], [39.75, 54.25], [33.5, 54.25]]
track AIN3 top w=0.2 pts=[[33.5, 54.25], [33, 54.25], [33, 55]]
track AIN0 top w=0.25 pts=[[35, 15.8], [34.5, 16], [33.25, 16], [32.8, 15.75]]
track AIN0 top w=0.25 pts=[[32.8, 15.75], [32.5, 16], [32.5, 17.5], [32.8, 17.75]]
track AIN0 bottom w=0.2 pts=[[32.5, 16.75], [32.5, 18.5], [32, 19], [32, 50.75], [33.25, 52], [33.25, 52.5]]
track AIN0 top w=0.2 pts=[[33.25, 52.5], [34.5, 52.5]]
track SWDIO in2 w=0.2
  pts=[[54.635, 36.21], [54.5, 35.75], [54.25, 35.5], [54.25, 35.25], [46.5, 35.25], [43.25, 38.5], [40.5, 38.5], [30, 49], [28, 49], [27.75, 48.75], [25, 48.75], [24.75, 49]]
track SWDIO top w=0.2 pts=[[24.75, 49], [26, 49]]
track LED_FAULT top w=0.2 pts=[[50.3, 35.25], [50, 35.5], [49.75, 35.75], [49.75, 36], [49.5, 36.25]]
track LED_FAULT bottom w=0.2 pts=[[49.5, 36.25], [34, 51.75], [34, 53], [33.75, 53.25], [32.75, 53.25]]
track LED_FAULT top w=0.2 pts=[[32.75, 53.25], [30.25, 53.25], [30, 53], [29, 53], [28.5, 53.5], [28.5, 55]]
track ACK_IN top w=0.25 pts=[[20.5, 67.3], [20, 67], [19.5, 66.5]]
track ACK_IN in1 w=0.25 pts=[[19.5, 66.5], [19.5, 61.25], [18.5, 60.25], [18.5, 53.25], [2.5, 37.25], [2.25, 36.75]]
track CAN_L top w=0.25 pts=[[26.85, 66.25], [26.5, 66.75], [26.5, 68], [26.8, 68.75]]
track CAN_L top w=0.25 pts=[[26.8, 68.75], [27.25, 69.5], [27.5, 69.75], [27.5, 70.25], [28, 70.75], [28.2, 71.15]]
track CAN_L in2 w=0.25
  pts=[[26.5, 67.25], [24, 67.25], [10, 53.25], [9.75, 53.25], [9.5, 53], [8.75, 53], [2.75, 47], [2.25, 46.75]]
track +12V top w=1.7 pts=[[28.47, 36.1], [29, 37], [29, 38.25], [28.4, 39]]
track +12V top w=1.7 pts=[[28.4, 39], [29.5, 39.75], [31.5, 41.75], [32.6, 42.5]]
track +12V top w=1.8 pts=[[28.47, 36.1], [28, 35], [27.25, 34.25], [26.75, 34.25]]
track +12V in2 w=1.8 pts=[[26.75, 34.25], [22.5, 30], [22.25, 30]]
track +12V top w=1.8 pts=[[22.25, 30], [22.25, 29.25], [21.3, 28.5]]
track +12V in2 w=1.05 pts=[[22.25, 30], [22, 29.75], [22, 28.5], [21, 27.5], [21, 25.25], [20.25, 24.5], [20.25, 22.5]]
track +12V top w=1.05 pts=[[20.25, 22.5], [19.75, 22.5], [19.2, 22.25]]
track +12V top w=0.2 pts=[[20.25, 22.5], [20.75, 22.5], [21.85, 21.5]]
track +12V in2 w=1.7 pts=[[24.25, 31.75], [16.75, 39.25]]
track +12V top w=1.7 pts=[[16.75, 39.25], [16, 39.25], [15.1, 39.5]]
track +12V top w=1.7
  pts=[[15.1, 39.5], [16, 40.25], [16.75, 40.25], [17.5, 41], [17.75, 41], [18.5, 41.75], [18.5, 42.25], [19.25, 43], [19.25, 45.75], [18.5, 46.5], [18.25, 46.5], [18, 46.75], [17.1, 47.5]]
track +12V top w=1.7 pts=[[17.1, 47.5], [16, 48.25], [15, 49.25], [15, 52.25], [15.1, 53]]
track +12V in2 w=1.7 pts=[[20.25, 23.5], [34, 23.5]]
track +12V top w=1.7 pts=[[34, 23.5], [34.5, 23.5], [35.6, 24]]
track I2C_SDA top w=0.2 pts=[[44.55, 43.155], [44, 43.25], [43.5, 43.75]]
track I2C_SDA in2 w=0.2 pts=[[43.5, 43.75], [38.75, 43.75], [36, 46.5], [35.75, 46.5], [33.5, 48.75], [31.25, 48.75]]
track I2C_SDA top w=0.2 pts=[[31.25, 48.75], [30.75, 48.25], [30.5, 48.25], [30.5, 46.5]]
track I2C_SCL top w=0.2
  pts=[[44.55, 41.885], [44, 42], [40.5, 42], [40.25, 42.25], [39.5, 42.25], [39.25, 42.5], [37.5, 42.5]]
track I2C_SCL bottom w=0.2 pts=[[37.5, 42.5], [35.25, 44.75]]
track I2C_SCL top w=0.2 pts=[[35.25, 44.75], [31, 44.75], [30.5, 45.25], [30, 45.25], [30, 46.5]]
track DOUT0 top w=0.2 pts=[[6.25, 44.8], [6.5, 45], [7.25, 45]]
track DOUT0 in2 w=0.2 pts=[[7.25, 45], [10.5, 45], [11.5, 44], [26.75, 44], [27.25, 44.5], [28, 44.5]]
track DOUT0 top w=0.2 pts=[[28, 44.5], [28.5, 45], [28.5, 46.5]]
track DOUT2 top w=0.2 pts=[[8.25, 52.2], [8.5, 51.75], [9.25, 51.75]]
track DOUT2 in2 w=0.2 pts=[[9.25, 51.75], [19.5, 51.75], [25.5, 45.75]]
track DOUT2 top w=0.2 pts=[[25.5, 45.75], [27.5, 43.75], [28.5, 43.75], [29.5, 44.75], [29.5, 46.5]]
track B23_GATE top w=0.25 pts=[[18.3, 50.25], [18.75, 50.5], [19.25, 50.5]]
track B23_GATE in1 w=0.25 pts=[[19.25, 50.5], [19.25, 52.5]]
track B23_GATE top w=0.25 pts=[[19.25, 52.5], [18.5, 52.5], [18.25, 52.2]]
track B23_GATE in1 w=0.25 pts=[[19.25, 50.5], [30.75, 39], [36.75, 39]]
track B23_GATE top w=0.25 pts=[[36.75, 39], [37, 38.75], [37, 38.5], [37.35, 38.3]]
track B36_A top w=0.25 pts=[[43.75, 35.7], [44, 35.25], [45.5, 35.25], [45.75, 35.7]]
track DIN1 top w=0.25 pts=[[41.7, 38.5], [41.75, 38], [41.75, 36.5], [41.8, 36.25]]
track DIN1 top w=0.25 pts=[[41.8, 36.25], [42, 36], [42, 34.5], [41.8, 34.25]]
track DIN1 top w=0.25 pts=[[41.7, 38.5], [42, 39], [42, 40.5], [42.4, 41]]
track DIN1 top w=0.2 pts=[[41.7, 38.5], [41.25, 39], [40.5, 39.75], [40.25, 39.75]]
track DIN1 in1 w=0.2 pts=[[40.25, 39.75], [38.25, 41.75], [37, 41.75], [30.5, 48.25], [30.5, 49.25], [30.75, 49.5]]
track DIN1 top w=0.2 pts=[[30.75, 49.5], [32, 49.5], [32.25, 49.25], [32.5, 49.25], [32.75, 49], [34.5, 49]]
track GND_CISO top w=0.5 pts=[[45.73, 68.25], [45.5, 67.5], [45.5, 64], [45.2, 63.5]]
track GND_CISO top w=0.5 pts=[[45.2, 63.5], [44.75, 63], [44.75, 61], [45.35, 60.945]]
track GND_CISO in1 w=0.5 pts=[[45.73, 68.25], [45.5, 67.5], [43, 65], [43, 63.5], [42, 62.5]]
track GND_CISO top w=0.5 pts=[[42, 62.5], [41.5, 63], [41.2, 63.5]]
track GND_CISO in1 w=0.5
  pts=[[42, 62.5], [42, 60.5], [43.25, 59.25], [43.25, 59], [43.5, 58.75], [43.5, 57.5], [44.25, 56.75], [44.25, 55.75], [43.75, 55.25]]
track GND_CISO top w=0.5 pts=[[43.75, 55.25], [43.75, 53.75], [44.25, 53.75], [44.5, 53.5], [45.35, 53.325]]
track GND_CISO top w=0.5
  pts=[[45.73, 68.25], [45.25, 68.75], [45, 68.75], [44.25, 69.5], [44, 69.5], [43.75, 69.75], [37.75, 69.75], [34.75, 66.75], [34.25, 66.75], [34, 66.5], [34, 66], [33.7, 65.75]]
track GND_CISO top w=0.5 pts=[[33.7, 65.75], [33.25, 65.5], [33, 65.25], [33, 64], [32.845, 63.45]]
track GND_CISO top w=0.5 pts=[[32.845, 63.45], [32.75, 62.75], [31, 62.75], [30.75, 62.3]]
track GND_CISO top w=0.5 pts=[[30.75, 62.3], [30.5, 62], [29, 62], [28.75, 62.3]]
track GND_CISO in1 w=0.5 pts=[[42, 60.5], [41.75, 60.25], [40.5, 60.25], [39.5, 59.25], [34.5, 59.25]]
track GND_CISO top w=0.5 pts=[[34.5, 59.25], [34.25, 59], [34.25, 58.75], [34.115, 58.05]]
track GND_CISO top w=0.15
  pts=[[43.75, 54.25], [40, 54.25], [39.75, 54], [39.75, 53.5], [37.5, 53.5], [37, 54], [36.75, 54.3]]
track GND_CISO top w=0.5 pts=[[34.25, 66.75], [29, 72], [29, 72.25], [28.25, 72.25], [27.5, 73], [27.25, 73.35]]
track GND_CISO in1 w=0.5 pts=[[43.75, 55.25], [43.75, 51.75], [44.5, 51], [44.5, 49], [44.75, 48.75], [44.75, 34.25]]
track GND_CISO top w=0.5 pts=[[44.75, 34.25], [45.25, 33.75], [45.25, 33.25]]
track GND_CISO top w=0.5 pts=[[28.75, 62.3], [28.5, 62], [25.25, 62]]
track GND_CISO bottom w=0.5 pts=[[25.25, 62], [13.5, 50.25]]
track GND_CISO in2 w=0.5 pts=[[13.5, 50.25], [8, 50.25], [2.75, 45], [2.25, 44.75]]
track ISO_CAN_RX top w=0.25 pts=[[45.35, 58.405], [44.5, 58.5], [43.75, 59.25], [43.75, 60]]
track ISO_CAN_RX in2 w=0.25 pts=[[43.75, 60], [39.25, 60], [37.5, 58.25]]
track ISO_CAN_RX top w=0.25 pts=[[37.5, 58.25], [36.75, 58.25], [36.655, 58.05]]
track CAN_H top w=0.25 pts=[[26.85, 64.25], [26.5, 63.75], [26.5, 63.25]]
track CAN_H bottom w=0.25 pts=[[26.5, 63.25], [26.5, 59.5]]
track CAN_H top w=0.25 pts=[[26.5, 59.5], [26.5, 59], [26.3, 58.25]]
`;
