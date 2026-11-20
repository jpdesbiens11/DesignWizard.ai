# La liaison RS-485, de la pièce au code

Demande de JP (20 novembre 2026) : « ajouter les composantes et la fonction "communication" RS-485 avec un exemple
concret : pièce, connecteur, traces, signaux et contribution au code logiciel — on aura l'interface HW/SW ».

Une liaison série, c'est quatre choses qui doivent s'accorder : ce qui est soudé sur la carte, ce qui se lit sur le
bus, ce que le logiciel fait de trois broches, et ce que disent les textes. L'outil les tire d'**une seule source par
sujet** :

| Sujet | Source unique | Qui s'en sert |
|---|---|---|
| Ce qui est publié sur la couche électrique | `web/js/pcba/rs485.js` | le bloc de carte, ses essais, la fiche |
| La trame, le caractère, les silences, le CRC | `web/js/sw/rs485_link.js` (le MODÈLE) | l'essai « Une trame sur le bus », le pilote C, la fiche |
| Le pilote | `web/js/sw/rs485_c.js` (écrit le C à partir du modèle) | le .zip |
| Où matériel et logiciel se touchent | `web/js/sw/hwsw.js` (lu des nets de la carte) | l'écran PCBA, le Word, le PDF |

## 1. Ce qui a été lu, et ce qui ne l'a pas été

**La norme TIA/EIA-485-A est payante et n'a pas été lue.** Les valeurs viennent de notes d'application et de fiches
publiques de fabricants qui la reprennent, ouvertes et relues page par page :

- Texas Instruments SLLA272D, « The RS-485 Design Guide » — niveaux, charge unitaire, câble, terminaison,
  dérivation, débit et longueur ;
- Texas Instruments SLLA070D — la même couche, vue du côté de la norme ;
- Texas Instruments SLYT324 et Renesas AN1986 — la polarisation du bus au repos, chacune avec un exemple chiffré ;
- Texas Instruments SLLA292A — la protection contre les transitoires ;
- les fiches THVD1410 / THVD1450, SN65HVD3082E (TI) et ISL8483E / ISL8485E (Renesas) — le brochage du boîtier
  8 broches, identique dans les quatre fiches lues ;
- « MODBUS over Serial Line — Specification and Implementation Guide V1.02 » — la trame, pages 12 à 15, 20 à 22,
  27 à 32 et 39 à 42.

Chaque valeur que l'outil montre dit sa page (`RS485_FACTS`, `RTU_RULES`). Là où deux notes impriment des nombres
différents, les deux sont gardés : la règle de pouce longueur × débit vaut 10⁷ dans SLLA272D et 10⁸ dans SLLA070D —
l'outil retient la plus prudente et montre l'autre.

**Non lu** : TIA/EIA-485-A ; RTCA DO-160, à laquelle un équipement embarqué est qualifié (foudre, décharges,
susceptibilité) ; la couche application de MODBUS ; les notes d'Analog Devices, dont le site n'a pas répondu.

Fabricants et séries sont cités en texte, comme références de compatibilité : ni logo, ni dessin copié. La fiche du
composant acheté fait foi.

## 2. Le bloc de carte

« Interface RS-485 » (`web/js/pcba/blocks_control.js`), groupe « Communiquer ». Six réglages, tous à choix :

| Réglage | D'office | Ce qu'il pose |
|---|---|---|
| Terminaison de ligne | oui | 120 Ω entre les deux lignes — ou la valeur que la polarisation laisse |
| Polarisation du bus au repos (failsafe) | non | deux résistances : A vers l'alimentation, B vers la masse |
| Protection des lignes | oui | un double écrêteur au bornier, 10 Ω en série sur chaque ligne |
| Bornier du bus sur la carte | oui | 3 pôles : 1 = A (D1), 2 = B (D0), 3 = commun |
| Nœuds sur le bus | 8 | sert à compter les charges unitaires |
| Alimentation | 3,3 V | celle du transceiver, et de la polarisation |

Toujours posés : le transceiver, son découplage, et un rappel de 10 kΩ sur DE et RE reliés — l'émetteur reste coupé
tant que le microcontrôleur n'a pas démarré (fiche THVD14xx, § 12.1).

**La polarisation** suit la formule des deux notes : `RB = (VS / VAB + 1) / (1 / 375 Ω + 4 / Z0)`, avec VS
l'alimentation moins 5 % et VAB = 0,25 V. À 5 V, le bloc redonne exactement l'exemple imprimé par SLYT324 : 556 Ω,
549 Ω dans la série E96, terminaison de ce bout ramenée à 133 Ω, 10 charges unitaires laissées au bus.

À 3,3 V, la formule demande une résistance si basse qu'elle ne laisserait pas au bus de quoi porter ses nœuds :
**l'outil la relève, et dit que le bus au repos tombe sous les 0,25 V visés** — il faut alors un récepteur à seuil
décalé, ou une polarisation alimentée en 5 V (c'est ce qu'écrit MODBUS : rappel vers 5 V, entre 450 Ω et 650 Ω).

**Les noms.** La broche A du circuit monte quand DI est à 1 (fiches lues) ; MODBUS appelle D1 la ligne qui est la
plus haute pour un 1, et lui donne le nom « B/B' » de la norme. Donc la broche A du circuit est D1, la broche B est
D0. C'est une déduction de deux textes lus, pas une phrase d'un seul : à vérifier sur le composant monté.

**Les pistes** (notes du bloc, que le PCBA affiche) : A et B routées ensemble, de même longueur, sur la couche du
dessus et au-dessus d'un plan de masse ; écrêteur et résistances série au plus près du bornier ; le transceiver près
du bornier, pour que la dérivation reste courte. L'outil ne route pas encore une paire différentielle comme telle :
il route les deux nets, et dit la règle.

## 3. Les essais du Labo

| Essai | Ce qu'il montre |
|---|---|
| Première mise sous tension | commun à tout bloc alimenté |
| Niveaux différentiels | DE à 1 : A et B s'écartent dans un sens puis dans l'autre |
| **Bus au repos (failsafe)** | DE à 0 : avec polarisation, A − B reste au-dessus de 0,2 V ; sans, il est nul |
| **Une trame sur le bus** | la trame de l'exemple de la spécification — `02 07 41 12` — à 19 200 bit/s : DE la couvre |

Le dernier est celui où matériel et logiciel se rejoignent : la trame que l'oscilloscope montre est celle que le
pilote construit, par le même modèle. Les quatre essais passent dans « Manipulation en labo » sans rien déclarer.

Le transceiver simulé est un **comportement typique** (`web/js/pcba/lab_devices.js`), jamais celui d'une référence :
aucune carte réelle n'a été mesurée.

## 4. L'interface matériel / logiciel

Lue des nets de la carte (`rs485Links`), pour chaque bloc RS-485 :

| Symbole du logiciel | Broche du transceiver | Ce que le logiciel en fait |
|---|---|---|
| `RS485_UART_TX` | DI | les octets à émettre |
| `RS485_UART_RX` | RO | les octets reçus, une interruption par octet |
| `RS485_DE` | DE et RE reliés | 1 : ce nœud émet |

et la broche du microcontrôleur qui porte chacun — sur la carte d'exemple : PA9, PA10, PB1. Un signal que le
microcontrôleur ne tient pas est signalé.

Les temps viennent du modèle : un caractère de 11 bits, 573 µs à 19 200 bit/s ; t1,5 = 859 µs ; t3,5 = 2 005 µs
(750 µs et 1,750 ms au-delà de 19 200 bit/s). **Le piège le plus courant** : rendre le bus sur « tampon vide » au
lieu de « transmission terminée » — le dernier octet est tronqué.

Dans le PCBA, étape « Revue », le groupe « Interface matériel / logiciel » montre le tableau et sort :

- la **fiche** en Word et en PDF, au gabarit des documents (`hwswDoc`) ;
- le **pilote C** en .zip (`driverFiles`).

## 5. Le pilote que l'outil écrit

Quatre fichiers, en C99 sobre — pas d'allocation, types à largeur fixe, aucune bibliothèque de fabricant :

- `rs485_link.h` — les constantes de la liaison, l'interface du port, l'état d'un lien, et en commentaire les
  broches de la carte ;
- `rs485_link.c` — le CRC-16, la mise en trame, l'émission (DE d'abord, les octets un bit plus tard, le bus rendu
  sur « transmission terminée »), la réception octet par octet, la fin de trame par le silence ;
- `rs485_link_test.c` — un programme pour n'importe quel ordinateur ;
- `rs485_vectors.txt` — les trames de référence, avec leur source.

Quatre fonctions restent à écrire dans le projet : la broche DE, l'UART, « transmission terminée », une horloge en
microsecondes. Ce sont elles, l'interface matériel / logiciel.

**L'essai dos à dos.** Le C généré est compilé avec tous les avertissements en erreur, exécuté, et ce qu'il écrit
est comparé ligne à ligne à ce que le modèle annonce (`cExpected`) : les quatre trames imprimées, la séquence
d'émission, la fin de trame, un CRC faux, un trou dans une trame. Sans compilateur sur le poste, l'essai est sauté
et le dit.

**Les trames de référence** sont IMPRIMÉES par d'autres : l'exemple de CRC de la spécification MODBUS (p. 41) et
trois trames d'un tutoriel public. Le modèle et le C doivent tous deux les redonner.

## 6. L'exemple : le nœud de mesure RS-485

`NODE-485-PCBA` (`tools/gen_demo_rs485.mjs` l'écrit, `web/js/demo/demo_rs485.js` le charge) : une petite carte qui
reçoit le 5 V, mesure une température et répond sur un bus RS-485. Huit blocs, 42 composants, 54 × 44 mm, quatre
couches, toutes ses liaisons routées, aucune erreur de règles électriques ni de fabrication. Son bloc RS-485 est
celui de l'exemple imprimé : 5 V, 549 Ω, 133 Ω.

Elle se charge du PCBA (« Exemple RS-485 ») et du Labo ; une seule copie par projet.

## 7. Ce qui est vérifié, ce qui ne l'est pas

- **Vérifié par les tests** (`tests/node/rs485.test.mjs`) : les exemples chiffrés de SLYT324 et d'AN1986 et la table
  des dérivations de SLLA272D reviennent ; le bloc à ses différents réglages ; les trois essais tournent et lisent
  ce que la conception annonce ; les quatre trames imprimées ; le pilote compilé écrit ce que le modèle annonce ;
  l'interface lue de la carte d'exemple ; ses documents Word et PDF ; ses règles électriques et de fabrication.
- **Simulé, non mesuré** : les niveaux du bus.
- **Non vérifié** : le pilote n'a tourné sur aucun microcontrôleur ; aucune carte réelle n'a été montée ; aucune
  exigence de niveau de développement du logiciel (DO-178C, ISO 26262) n'est couverte ; l'outil ne vérifie pas
  l'appairage des deux pistes.

## 8. Pour une nouvelle liaison

Une autre liaison (CAN, liaison isolée en chaîne) suit le même partage : ce qui est publié dans un module, avec sa
page ; le modèle de la trame dans `web/js/sw/` ; le pilote écrit à partir du modèle, avec ses trames imprimées et
son essai dos à dos ; l'interface lue de la carte. Un protocole se dit toujours comme un exemple, sauf si le projet
l'a choisi.
