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

Les deux phrases du film : **« La conception, sans les détours. »** / *« Design, without the detours. »* à l'ouverture,
**« Moins de clics. Plus de conception. »** / *« Fewer clicks. More engineering. »* à la fin.

## Ce que le film montre

Rien qui ne soit dans l'outil : les images sont les **vrais écrans** — les captures de la présentation guidée
(`web/img/tour`) et deux plans filmés sur l'application qui tourne (le Rover qui pivote et s'ouvre en vue éclatée ; un
paramètre qui grimpe sous une flèche maintenue, ×1 à ×10, pendant que la pièce suit). Les phrases sont celles de la
présentation guidée : le film n'annonce rien de plus qu'elle.

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

## La voix

**Le film parle depuis la v0.81.0** (18 novembre 2026) : une voix de synthèse (choix de JP : ElevenLabs, voix
« Jessica », modèle multilingue), la même en français et en anglais. Jusque-là le film était muet et sa narration
incrustée dans l'image. Le texte complet de la narration reste donné sous chaque lecteur de la vitrine, pour qui ne
voit pas l'image ou n'entend pas le son.

Refaire la voix ne demande pas de refaire le film. **Voix de synthèse** :

1. Rendre l'image sans sous-titres incrustés : `node tools/film_render.mjs <plans> <sortie> fr en --no-captions`.
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

**Règle de JP : la voix joue dans les haut-parleurs et les sous-titres sont éteints ; si l'usager coche « Sans son »,
les sous-titres s'allument.** Le film parlé n'a donc plus de sous-titres dessinés dans l'image ; ils deviennent une
piste (`designwizard_<langue>.vtt`) que le lecteur ne montre que s'il est muet ou si son volume est à zéro
(`web/js/core/captions.js` : `wantCaptions`, `followSound`). Une case **« Sans son »**, sous le film, le dit en
toutes lettres : cochée, elle coupe le son du lecteur et les sous-titres apparaissent ; décochée, la voix revient
(`muteBox` ; elle suit aussi le bouton muet du lecteur). Dans l'application, c'est `showFilm` qui pose la piste et la
case ; sur la vitrine, c'est le seul script de la page, `web/js/vitrine.js` (aucune requête, rien de gardé), et la case
y est écrite cachée : elle ne se montre que si le script est là pour la faire marcher.

Limite à connaître : **une page ne lit pas le volume de l'ordinateur**, seulement celui du lecteur — son bouton muet et
sa glissière. Qui a coupé le son du poste, ou débranché ses haut-parleurs, allume les sous-titres par le bouton du
lecteur ; ce choix est laissé tel quel jusqu'au prochain changement de son du lecteur.

Le site a donc deux états, dits par `FILM.voice` (`web/js/core/film.js`) et tenus cohérents par les tests :

| | Muet (jusqu'à la v0.80.1) | Parlé (aujourd'hui) |
|---|---|---|
| `web/video/designwizard_<langue>.mp4` | narration incrustée dans l'image, pas de son | une voix, image sans sous-titres |
| Sous-titres | dans l'image | piste `.vtt`, montrée quand le son du lecteur est coupé |
| Vitrine | aucun script | un script maison (`js/vitrine.js`), `script-src 'self'` |
| Sous le film | rien | la case « Sans son » |
| Ce que la page dit | « Sans son : la narration se lit à l'écran. » | « Cochée : le son se coupe et les sous-titres apparaissent. » |

Passer de l'un à l'autre est une commande, une fois les deux films parlés faits :

`node tools/film_speak.mjs <film parlé fr.mp4> <film parlé en.mp4>`

Elle copie les films, met `FILM.voice` à vrai, donne à chaque lecteur de la vitrine sa piste de sous-titres et sa case
« Sans son », à la page son script et le droit de le lancer, et change les phrases qui parlaient d'un film muet. Sur un
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

## Le film et la v0.91

Le film publié est celui de la v0.81 : ses images sont les écrans de cette version, et il ne parle ni des variantes,
ni des sous-assemblages, ni des cas de charge à comparer — la présentation guidée, elle, a été mise à jour (v0.91.1).
Il n'a **pas été rendu de nouveau**, pour trois raisons : ce qu'il dit reste vrai ; montrer les nouveautés demande une
narration nouvelle, donc une nouvelle voix de synthèse (le compte et le forfait de JP) ; et chaque rendu ajoute environ
22 Mo à l'historique du dépôt. C'est une décision de JP.

À savoir avant un prochain rendu : les captures de `web/img/tour` ont été refaites sur la v0.91, et celle de la pièce
(`piece.jpg`) montre maintenant le panneau de rotation automatique. La scène « Pièce » du film cadre cette image : son
cadrage (`tools/film/script.mjs`) est à revoir, comme celui des scènes dont les volets ont changé d'aspect.

## Ce qui est vérifié, ce qui ne l'est pas

- Vérifié par les essais (`tests/node/film.test.mjs`, `tests/py`) : la ligne de temps (scènes bout à bout, deux langues
  partout, répliques qui ne se chevauchent pas et restent dans leur scène, débit), les fichiers publiés (durée lue dans
  le MP4, index en tête, poids), les sous-titres et la narration identiques à la ligne de temps, la vitrine (lecteurs,
  texte de la narration, pas de script), le service par morceaux.
- Vérifié à l'œil : des images de chaque scène dans les deux langues, la lecture dans Chromium.
- **Pas vérifié** : la lecture dans Safari et Firefox, sur téléphone ; le texte anglais par quelqu'un dont c'est la
  langue ; le rythme de la narration dite par une vraie voix.
