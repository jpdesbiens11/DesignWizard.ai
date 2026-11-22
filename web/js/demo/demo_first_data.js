/* DesignOrbit.ai — the first board of the Labo, written by tools/gen_demo_first.mjs : a coin cell, two buttons, a red LED and a yellow
   LED, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */

export const DEMO_FIRST = `dwiz board/1 FIRST-PCBA "Première carte : une pile, deux boutons, deux DEL"
# DesignOrbit.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.

# Pourquoi — les fonctions que la carte remplit
description "La carte la plus simple du Labo : une pile bouton, et deux boutons qui allument chacun leur DEL — rouge pour S1, jaune pour S2. Rien à programmer : on y apprend le circuit, les mesures, et l'ordre qui protège une carte."
revision A
function F1 parent=null kind=principale name="Alimenter la carte par une pile" block=null
  criterion name=Source level="pile bouton CR2032, 3 V" flex=F1
  criterion name="Consommation au repos" level=aucune flex=F0
function F2 parent=null kind=principale name="Allumer la DEL rouge tant que l'on appuie sur S1" block=null
  criterion name=Courant level="2 mA" flex=F1
function F3 parent=null kind=principale name="Allumer la DEL jaune tant que l'on appuie sur S2" block=null
  criterion name=Courant level="2 mA" flex=F1
function F4 parent=null kind=principale name="Être mesurable par un débutant" block=null
  criterion name=Accès level="points de test sur la pile et la masse" flex=F1
function F5 parent=null kind=contrainte name="Tenir dans la main" block=null
  criterion name=Carte level="50 × 34 mm, deux couches" flex=F1
function F1.1 parent=F1 kind=technique name="Alimenter la carte par une pile bouton 3 V" block=B1 auto=true
  criteria = []
function F2.1 parent=F2 kind=technique name="Allumer la DEL rouge tant que l'on appuie sur le bouton S1" block=B2
  auto=true
  criteria = []
function F3.1 parent=F3 kind=technique name="Allumer la DEL jaune tant que l'on appuie sur le bouton S2" block=B3
  auto=true
  criteria = []
function F4.1 parent=F4 kind=technique name="Rendre la carte testable et plaçable en machine" block=B4 auto=true
  criteria = []

# Comment — un bloc de circuit par fonction
block B1 battery name=Pile function=F1.1 zone=[1.5, 1.5, 35, 31.5] connect={VBAT: +3V, GND: GND}
  params v=3 i=4
block B2 push_led name="Bouton et témoin" function=F2.1 zone=[36.5, 1.5, 12, 13] connect={VDD: +3V, GND: GND}
  params v=3 i=2 color=rouge name=S1
block B3 push_led name="Bouton et témoin" function=F3.1 zone=[36.5, 14.5, 12, 13] connect={VDD: +3V, GND: GND}
  params v=3 i=2 color=jaune name=S2
block B4 test name="Points de test et mires" function=F4.1 zone=[36.5, 28, 12, 5] connect={T1: +3V, T2: GND}
  params nets="+3V,GND" fiducials=3

# Avec quoi — les composants, et les nets qui les relient
part BT1 BAT-CR2032 value=CR2032 block=B1 at=[18.75, 17.25] rot=0 side=top local=BT role="Pile bouton 3 V"
part SW1 SW-TACT-6 value="" block=B2 at=[39.75, 8.75] rot=90 side=top local=SW role="Bouton S1"
part R1 R-0603 value="560 Ω" block=B2 at=[45, 4.75] rot=0 side=top local=R role="Fixe le courant de la DEL" near=SW1
part D1 LED-0603 value=rouge block=B2 at=[45.75, 7.5] rot=270 side=top local=D role="Témoin rouge" near=R1
part SW2 SW-TACT-6 value="" block=B3 at=[41.75, 17.75] rot=180 side=top local=SW role="Bouton S2"
part R2 R-0603 value="510 Ω" block=B3 at=[37.75, 23] rot=90 side=top local=R role="Fixe le courant de la DEL" near=SW2
part D2 LED-0603 value=jaune block=B3 at=[39.75, 23] rot=90 side=top local=D role="Témoin jaune" near=R2
part TP1 TP-1.0 value=+3V block=B4 at=[44.75, 28.75] rot=0 side=top local=TP1 role="Accès de mesure à +3V"
part TP2 TP-1.0 value=GND block=B4 at=[41.25, 28.75] rot=0 side=top local=TP2 role="Accès de mesure à GND"
part FID1 FID-1.0 value="" block=B4 at=[3, 3] rot=0 side=top local=FID1 role="Repère optique de placement" corner=1
part FID2 FID-1.0 value="" block=B4 at=[33.5, 3] rot=0 side=top local=FID2 role="Repère optique de placement" corner=2
part FID3 FID-1.0 value="" block=B4 at=[3, 31] rot=0 side=top local=FID3 role="Repère optique de placement" corner=3
net +3V class=power voltage=3 current=0.004 pins=[BT1.+, SW1.A, SW2.A, TP1.TP]
net GND class=ground voltage=0 current=0 pins=[BT1.-, D1.K, D2.K, TP2.TP]
net B2_LIT class=signal voltage=0 current=0 pins=[SW1.B, R1.1]
net B2_A class=signal voltage=0 current=0 pins=[R1.2, D1.A]
net B3_LIT class=signal voltage=0 current=0 pins=[SW2.B, R2.1]
net B3_A class=signal voltage=0 current=0 pins=[R2.2, D2.A]

# Sur quoi — la carte nue : couches, finition, vernis, trous, règles
board size=[50, 34] r=1 t=1.6 layers=2 copper=35 finish=ENIG mask=vert silk=blanc
  coating type=none thickness=50 sides=both
  holes = []
rules fab=standard
  classes = {}

# Le cuivre — plans, pistes et vias
planes = []
track GND top w=0.5
  pts=[[33.4, 17.25], [34.5, 19.25], [34.75, 19.5], [34.75, 19.75], [36.25, 21.25], [39, 21.25], [39.5, 21.75], [39.75, 22.2]]
track GND top w=0.5
  pts=[[39.75, 22.2], [40, 22.5], [40.5, 22.5], [40.75, 22.75], [40.75, 23.5], [41, 23.75], [41, 27.75], [41.25, 28], [41.25, 28.75]]
track GND top w=0.5
  pts=[[33.4, 17.25], [34.5, 15.25], [34.75, 15], [34.75, 13.75], [35.75, 12.75], [35.75, 11.75], [36.5, 11], [43.25, 11], [45.5, 8.75], [45.75, 8.3]]
track +3V top w=0.5 pts=[[4.1, 17.25], [5.25, 15.25], [31, 15.25], [31.5, 14.75], [33.5, 14.75], [33.75, 14.5]]
track +3V bottom w=0.5 pts=[[33.75, 14.5], [34.25, 15], [35.75, 15]]
track +3V top w=0.5 pts=[[35.75, 15], [36.75, 15], [37.75, 15.5]]
track +3V top w=0.5 pts=[[37.75, 15.5], [37.75, 13.75], [37.5, 12.75]]
track +3V top w=0.5 pts=[[33.75, 14.5], [34, 14.25], [34, 13], [35, 12], [35, 11], [37, 9], [37, 5.75], [37.5, 4.75]]
track +3V top w=0.5 pts=[[37.75, 15.5], [45.75, 15.5]]
track +3V top w=0.5
  pts=[[45.75, 15.5], [44.75, 16], [44.75, 17.25], [44, 18], [44, 21], [44.75, 21.75], [44.75, 28.75]]
track B2_A top w=0.25 pts=[[45.8, 4.75], [45.75, 5], [45.75, 6.7]]
track B3_A top w=0.25 pts=[[37.75, 23.8], [38, 24], [39.5, 24], [39.75, 23.8]]
track B2_LIT top w=0.25 pts=[[42, 4.75], [44.2, 4.75]]
track B2_LIT top w=0.25
  pts=[[44.2, 4.75], [44.5, 4.5], [44.5, 4.25], [45, 3.75], [46.5, 3.75], [46.75, 4], [46.75, 9], [46.5, 9.25], [46.25, 9.25], [43.75, 11.75], [42.5, 11.75], [42, 12.75]]
track B3_LIT top w=0.25 pts=[[45.75, 20], [45, 19.5], [45, 19]]
track B3_LIT bottom w=0.25 pts=[[45, 19], [44.5, 19], [44, 19.5], [43, 19.5]]
track B3_LIT top w=0.25 pts=[[43, 19.5], [38.75, 19.5], [37.75, 20]]
track B3_LIT bottom w=0.25 pts=[[43, 19.5], [39.75, 22.75], [38.75, 22.75]]
track B3_LIT top w=0.25 pts=[[38.75, 22.75], [38.25, 22.75], [38, 22.5], [37.75, 22.2]]
via +3V at=[33.75, 14.5] d=0.8 drill=0.4
via +3V at=[35.75, 15] d=0.8 drill=0.4
via B3_LIT at=[45, 19] d=0.6 drill=0.3
via B3_LIT at=[43, 19.5] d=0.6 drill=0.3
via B3_LIT at=[38.75, 22.75] d=0.6 drill=0.3

# Comment elle s'assemble — la gamme annotée et la revue
review author=""
  open=["Vérifier sur la fiche de la DEL choisie sa tension directe à 2 mA : la résistance en dépend.", "Vérifier sur la fiche de la pile son courant continu admissible."]
  decisions=[]

# Autres données
fseq
  "" 5
`;
