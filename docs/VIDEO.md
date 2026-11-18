# La vidéo de présentation

Deux minutes trente-trois, entre la démonstration rapide et le film de marque : le problème (six logiciels autour d'une
pièce), le nom, puis le chemin d'une conception — intention, pièce, assemblage, carte, physique, dessins, IA — et le nom
de nouveau. Deux versions, **française et anglaise**, aux couleurs et sur le papier quadrillé de la plateforme.

| | |
|---|---|
| En ligne | https://jpdesbiens11.github.io/DesignWizard.ai/vitrine.html#film |
| Dans l'application | Accueil → « Voir la vidéo (2 min 33) » : une fenêtre, choix Français / English en cours de lecture |
| Fichiers | `web/video/designwizard_fr.mp4`, `designwizard_en.mp4` (1280 × 720, 24 images/s, H.264), leur image d'attente `.jpg`, leurs sous-titres `.vtt` |
| Narration à enregistrer | `docs/film/narration_fr.md`, `docs/film/narration_en.md` |
| Storyline — l'image et la voix, deux langues côte à côte | `docs/film/storyline.md` |

Une **bande-annonce de 30 s** est coupée de ce film — sept plans, sept répliques — pour le kit de lancement :
[LANCEMENT.md](LANCEMENT.md).

Les deux phrases du film : **« La conception, sans les détours. »** / *« Design, without the detours. »* à l'ouverture,
**« Moins de clics. Plus de conception. »** / *« Fewer clicks. More engineering. »* à la fin.

## Ce que le film montre

Rien qui ne soit dans l'outil : les images sont les **vrais écrans** — les captures de la présentation guidée
(`web/img/tour`) et deux plans filmés sur l'application qui tourne (le Rover qui pivote et s'ouvre en vue éclatée ; un
paramètre qui grimpe sous une flèche maintenue, ×1 à ×10, pendant que la pièce suit). Ce qui est **écrit** à l'écran —
titres, étiquettes, slogans — vient de la présentation guidée ; la voix, elle, raconte une histoire par-dessus (section
suivante). Le film n'annonce rien de plus que la présentation.

| Temps | Scène | À l'écran |
|---|---|---|
| 0:00 | Ouverture | « Six logiciels autour d'une pièce. » puis « Chaque tour de boucle coûte des jours. » |
| 0:15 | Le nom | la marque et « La conception, sans les détours. » |
| 0:23 | Atelier | la pièce naît de son intention |
| 0:39 | Pièce | le paramètre sous la flèche, puis le studio et ses règles de fabrication |
| 0:56 | Assemblage | le Rover : orbite, vue éclatée, retour |
| 1:13 | Carte électronique | la carte, puis ses fonctions |
| 1:27 | Physique et isolation | modèle analytique, simulation, lignes de fuite |
| 1:46 | Dessins, revue, commande | le dessin, la revue, le dossier de commande |
| 2:04 | Avec l'IA | l'entrevue : une tâche confiée, relue avant d'être acceptée |
| 2:17 | Fin | logiciel libre, licence MIT ; la marque et « Moins de clics. Plus de conception. » |

Les écrans de l'outil sont en français dans les deux versions ; seuls les titres, les étiquettes et la narration changent.
Chaque plan porte la marque en haut à gauche ; la dernière carte porte la note de marque (`core/brand.js`).

## L'histoire que la voix raconte

**Demande de JP (18 novembre 2026) : la voix ne lit pas l'écran.** Jusqu'à la v0.91, la narration redisait les titres et
les étiquettes des plans ; depuis la v0.92.0 elle raconte **une histoire que les images appuient**, pour qui découvre la
plateforme — un film de marque, plus vivant, en français ou en anglais au choix.

- **Le fil.** Une pièce commence par une question : à quoi doit-elle servir ? Celui qui conçoit le sait, mais il doit le
  redire à chaque logiciel. DesignWizard.ai est « l'outil qui retient le pourquoi » : on suit la pièce de sa question
  jusqu'à la commande, et le film se ferme sur la même phrase — « Une pièce commence par une question. Voici l'outil qui
  se souvient de la réponse. »
- **L'image montre, la voix raconte.** Dans l'Atelier, l'écran affiche les interfaces à la première personne (« Je me
  visse sur… », « Je reçois un arbre ») : la voix les fait parler. Devant la carte, elle dit que l'électronique « ne vit
  pas ailleurs » ; devant le dossier de commande, que « tout tient dans un seul dossier ».
- **Rien de plus que ce que l'outil fait.** Chaque phrase a été rapprochée de l'écran qu'elle accompagne et de ce que
  l'outil fait vraiment (la règle de paroi et son correctif, le foret standard, le verdict du recoupement, le plus court
  chemin entre conducteurs). Aucun chiffre de temps gagné : personne ne l'a mesuré.
- **Tenu par un essai.** `shownTexts(langue)` donne tout ce que le film écrit à l'écran ; `readsScreen(réplique, langue)`
  nomme ce qu'une réplique redirait mot pour mot (deux mots ou plus, sans tenir compte de la casse ni de la ponctuation).
  L'essai refuse une réplique qui lit l'écran, et un chiffre dans la narration.

Le storyline complet — pour chaque scène : ce qui est écrit à l'écran, l'image, et ce que la voix raconte en français
et en anglais — est dans `docs/film/storyline.md`, généré comme les sous-titres. **Changer l'histoire** : modifier les
répliques (`CUES`) de `tools/film/script.mjs`, puis

```bash
node tools/film_words.mjs
```

qui réécrit les sous-titres `.vtt`, les deux narrations, le storyline et le texte de la narration sous chaque lecteur
de la vitrine ; ensuite la voix (ci-dessous), qui ne redemande que les répliques changées et leurs voisines.

## La voix

**Le film parle depuis la v0.81.0** (18 novembre 2026) : une voix de synthèse (choix de JP : ElevenLabs, voix
« Jessica », modèle multilingue), la même en français et en anglais. Jusque-là le film était muet et sa narration
incrustée dans l'image. Le texte complet de la narration reste donné sous chaque lecteur de la vitrine, pour qui ne
voit pas l'image ou n'entend pas le son.

Refaire la voix ne demande pas de refaire le film. **Voix de synthèse** :

1. Rendre l'image sans sous-titres incrustés : `node tools/film_render.mjs <plans> <sortie> fr en --no-captions` — ou
   prendre le film publié lui-même : son image n'a pas de sous-titres, et l'outil ne garde que l'image de ce qu'on lui
   donne (c'est ainsi que la voix de la v0.92.0 a été posée, sans nouveau rendu).
2. Choisir la voix : `node tools/film_voice.mjs voices fr` (les voix de femme du compte ; `--library` pour la
   bibliothèque partagée), puis `node tools/film_voice.mjs sample <voix> fr <dossier>` pour entendre trois répliques.
3. Faire le film parlé : `node tools/film_voice.mjs make <voix> fr <film sans sous-titres> web/video/designwizard_fr.mp4`.
   Chaque réplique est demandée une fois (gardée dans le dossier de travail), posée à son temps, et l'ensemble est
   mis au niveau sonore du web (−16 LUFS) puis posé sur l'image, qui n'est pas redessinée. Une réplique plus longue
   que sa place — jusqu'à un souffle avant la suivante — est accélérée de 12 % au plus ; au-delà l'outil nomme la
   réplique à raccourcir et s'arrête. `--dry` essaie toute la chaîne sans appeler personne (des tonalités).
4. La clé d'API ne s'écrit nulle part dans le dépôt : variable `ELEVENLABS_API_KEY`, envoyée dans l'en-tête
   `xi-api-key` ; dans une session en nuage, c'est le réseau de la session qui la pose. Seul le texte de la narration
   part vers ElevenLabs. La clé a besoin de la permission « Text to Speech » ; lister les voix (`voices`) demande en
   plus « Voices » en lecture (sans elle, les voix d'origine du service se lisent sans clé).

**Voix enregistrée** (une personne) : d'après `docs/film/narration_<langue>.md`, une ligne, un souffle, chaque ligne
entre ses deux temps (le débit le plus rapide est de 2,6 mots par seconde) ; un seul fichier par langue, posé par
`ffmpeg -i designwizard_fr_sans-sous-titres.mp4 -i voix_fr.wav -c:v copy -c:a aac -b:a 160k -shortest designwizard_fr.mp4`.

## Le jour où le film parle

**Règle de JP depuis la v0.92.0 (18 novembre 2026) : les sous-titres restent avec la voix, et dans les deux langues.**
Le film parlé n'a pas de sous-titres dessinés dans l'image ; ce sont des pistes (`designwizard_<langue>.vtt`), et
**chaque lecteur porte les deux** : celle de la langue de la voix est montrée dès le départ — ce qui est dit est ce
qui est lu —, et un choix à côté du lecteur, **« Sous-titres : Français · English · Les deux · Aucun »**, permet
d'écouter dans une langue et de lire dans l'autre, de lire les deux à la fois, ou de ne rien lire
(`web/js/core/captions.js` : `subChoices`, `subModes`, `subChoice`, `subsBox`). Ce sont des boutons radio ordinaires
(flèches du clavier comprises), tenus au pas du menu de sous-titres du lecteur lui-même : un changement fait par ce
menu revient sur les boutons. Dans l'application, c'est `showFilm` qui pose les pistes et le choix, à côté de celui de
la voix (« Voix : Français · English ») ; quand on change de voix, des sous-titres qui suivaient la voix la suivent
encore, un choix fait par l'usager (l'autre langue, les deux, aucun) reste. Sur la vitrine, c'est le seul script de la
page, `web/js/vitrine.js` (aucune requête, rien de gardé) ; le choix y est écrit caché et ne se montre que si le script
est là pour le faire marcher — sans script, la piste de la langue du film se montre quand même (attribut `default`).

La règle d'avant (v0.81 à v0.91) — sous-titres éteints tant que la voix joue, allumés par une case « Sans son » — est
retirée avec sa case : le son du lecteur ne décide plus de rien, et couper le son laisse les sous-titres où ils sont.

Le site a donc deux états, dits par `FILM.voice` (`web/js/core/film.js`) et tenus cohérents par les tests :

| | Muet (jusqu'à la v0.80.1) | Parlé (aujourd'hui) |
|---|---|---|
| `web/video/designwizard_<langue>.mp4` | narration incrustée dans l'image, pas de son | une voix, image sans sous-titres |
| Sous-titres | dans l'image | deux pistes `.vtt` par lecteur ; celle de la voix montrée dès le départ |
| Vitrine | aucun script | un script maison (`js/vitrine.js`), `script-src 'self'` |
| Sous le film | rien | le choix des sous-titres : Français · English · Les deux · Aucun |
| Ce que la page dit | « Sans son : la narration se lit à l'écran. » | « La voix raconte ; les sous-titres restent, dans la langue de votre choix. » |

Passer de l'un à l'autre est une commande, une fois les deux films parlés faits :

`node tools/film_speak.mjs <film parlé fr.mp4> <film parlé en.mp4>`

Elle copie les films, met `FILM.voice` à vrai, donne à chaque lecteur de la vitrine ses deux pistes de sous-titres et
son choix, à la page son script et le droit de le lancer, et change les phrases qui parlaient d'un film muet. Sur un
site qui parle déjà, elle ne fait que remplacer les films. Chaque changement doit être
trouvé une seule fois, sinon rien n'est écrit. Ensuite : `node --test tests/node/film.test.mjs`, puis les textes qui
disent encore « sans son » (ce document, le README).

**Avant de publier une voix de synthèse, vérifier le forfait sous lequel elle a été faite.** Chez ElevenLabs, le forfait
gratuit ne permet pas l'usage commercial (et demande une mention) ; une vidéo de vitrine en est un. Le premier forfait
payant donne la licence commerciale, pour l'audio produit **pendant** l'abonnement : des répliques faites sous le
forfait gratuit sont à redire une fois abonné (un dossier de travail neuf, `--work`, pour que l'outil les redemande).
Relevé le 17 novembre 2026 d'une recherche qui cite l'aide d'ElevenLabs et plusieurs comparatifs (pages non lues en
entier) ; les conditions du service font foi.

État au 18 novembre 2026 : **le film parle en ligne**. Un premier jeu de répliques, fait le 17 sous le forfait
gratuit, n'a servi qu'à l'écoute et n'a pas été publié. JP a ensuite choisi de s'abonner ; les 48 répliques ont été
redites le 18 dans un dossier de travail neuf, puis publiées — elles tiennent toutes dans leur temps sans être
accélérées. Ce qui n'a pas pu être lu : le forfait lui-même (la clé n'a pas la permission de lire le compte). Le seul
indice vu est que le service annonçait alors 3 requêtes simultanées permises, valeur que des sources tierces donnent
pour le premier forfait payant (2 pour le gratuit) ; ce tableau n'a pas été trouvé dans la documentation du service.

La nouvelle histoire (v0.92.0) a été dite le même 18 novembre, sous l'abonnement, dans un dossier de travail neuf :
54 répliques (27 par langue), toutes dans leur temps sans être accélérées, posées sur l'image du film déjà publié.
**Personne ne l'a encore écoutée** : l'outil qui l'a faite n'entend pas — la prononciation, le ton et le naturel des
enchaînements sont à juger à l'oreille par JP.

## Refaire le film

Tout part d'**une seule ligne de temps**, `tools/film/script.mjs` (pure, testée) : les scènes, ce qui est cadré dans
chaque image au début et à la fin, les étiquettes, et les répliques de la narration avec leurs temps, en deux langues.
La page `tools/film/film.html` dessine le film **d'après le temps seul** (`window.filmSeek(t)`) : aucune animation ne
tourne d'elle-même, une image est la même chaque fois qu'on la redessine.

```bash
python3 designwizard.py --port 8130 --no-browser --data <dossier vide>
```

```bash
node tools/film_shots.mjs http://127.0.0.1:8130 <dossier des plans>
```

```bash
node tools/film_render.mjs <dossier des plans> web/video
```

- `tools/film_shots.mjs` filme les deux plans animés (265 images) sur l'application locale. Il faut Playwright.
- `tools/film_render.mjs` dessine les 3 672 images de chaque langue et les passe à `ffmpeg` (libx264) ; il écrit aussi
  l'image d'attente, les sous-titres `.vtt` et, dans `docs/film`, la narration. Environ trois minutes par langue.
  `--from 27 --to 36` rend un morceau pour le regarder ; `--crf` règle le poids (26 par défaut).
- Pour regarder le film dans un navigateur sans le rendre : servir le dépôt et ouvrir
  `tools/film/film.html?lang=fr&play=1` (les plans sous `/clips`, ou `&clips=<adresse>`).
- Quand un écran change : refaire d'abord les captures de la présentation (`tools/tour_shots.mjs`), puis le film.

**Le poids.** Une image qui ne cesse de bouger coûte cher : la première version pesait 22 Mo par langue. Chaque capture
est donc montrée entière un instant, **va vers ce dont parle la voix, puis tient en place** — un écran se lit quand il ne
bouge pas, et le film pèse environ 11 Mo. Un essai refuse un fichier de plus de 14 Mo : le dépôt et la démo en ligne
portent les deux films, et chaque nouveau rendu s'ajoute à l'historique.

**Le serveur local** sert maintenant un fichier par morceaux (`Range`), sans quoi un lecteur ne peut pas avancer dans le
film ; la vitrine n'a toujours aucun script (sa règle `media-src 'self'` autorise ses deux lecteurs, rien d'autre).

## Le film, la v0.91 et la v0.92

**L'image** du film publié est celle de la v0.81 : ses écrans sont ceux de cette version, et elle ne montre ni les
variantes, ni les sous-assemblages, ni les cas de charge à comparer — la présentation guidée, elle, a été mise à jour
(v0.91.1). Elle n'a **pas été rendue de nouveau** : ce qu'elle montre reste vrai, et chaque rendu ajoute environ 22 Mo
à l'historique du dépôt.

**La voix**, elle, est nouvelle depuis la v0.92.0 : la narration est devenue une histoire (plus haut), dite sur la même
image. Les deux films ont donc été remplacés une fois de plus dans le dépôt (même image, nouveau son). L'histoire ne
parle pas non plus des nouveautés de la v0.91 : elle suit les scènes qui existent.

À savoir avant un prochain rendu : les captures de `web/img/tour` ont été refaites sur la v0.91, et celle de la pièce
(`piece.jpg`) montre maintenant le panneau de rotation automatique. La scène « Pièce » du film cadre cette image : son
cadrage (`tools/film/script.mjs`) est à revoir, comme celui des scènes dont les volets ont changé d'aspect.

## Ce qui est vérifié, ce qui ne l'est pas

- Vérifié par les essais (`tests/node/film.test.mjs`, `tests/py`) : la ligne de temps (scènes bout à bout, deux langues
  partout, répliques qui ne se chevauchent pas et restent dans leur scène, débit, aucune réplique qui lit l'écran, aucun
  chiffre), les fichiers publiés (durée lue dans le MP4, index en tête, poids), les sous-titres, la narration et le
  storyline identiques à la ligne de temps, la vitrine (lecteurs, deux pistes par lecteur, choix des sous-titres, texte
  de la narration), ce que veut dire chaque choix de sous-titres, le service par morceaux.
- Vérifié dans Chromium (v0.92.0) : sur la vitrine et dans la fenêtre de l'accueil, la voix joue **et** les sous-titres
  se montrent ; l'autre langue, les deux à la fois, aucun ; le menu du lecteur ramène le choix sur les boutons ; les
  flèches du clavier ; le changement de voix dans la fenêtre. Vérifié à l'œil : des images de chaque scène.
- **Pas vérifié** : la nouvelle voix à l'oreille (prononciation, ton) ; la lecture dans Safari et Firefox, sur
  téléphone — en particulier deux pistes montrées à la fois, que chaque navigateur empile à sa façon ; le texte anglais
  par quelqu'un dont c'est la langue.
