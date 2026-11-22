# Le kit de lancement

Demande de JP (18 novembre 2026) : à partir de l'histoire du film, de quoi annoncer la plateforme — **une bande-annonce
d'environ 30 s, une fiche d'une page et des textes de publication prêts à poster**, en français et en anglais. Le kit
n'est pas dans l'application : ce sont des fichiers, produits par deux outils et déposés dans le Drive de JP, dans
« DynamiteOrbit » → « Communications et marketing » → `Marketing` → `Kit de lancement`, nommés `Sujet_AAAA-MM-JJ` ;
un kit refait remplace le précédent, qui descend dans un sous-dossier « Versions du AAAA-MM-JJ ».

| Fichier | Ce que c'est |
|---|---|
| `Bande-annonce_FR_…mp4`, `Bande-annonce_EN_…mp4` | 31,6 s, 1280 × 720, coupées du film ; une voix de synthèse raconte |
| `Bande-annonce_FR_….srt`, `…_EN_….srt` | les sous-titres, à joindre à la vidéo (la plupart des fils la lisent sans le son) |
| `Bande-annonce_script_….md` | ce qui est montré et ce qui est dit, les deux langues côte à côte |
| `Fiche-une-page_FR_….pdf`, `…_EN_….pdf` | une page Letter : la promesse, l'histoire en trois phrases, un écran réel, ce que l'on fait avec l'outil en trois groupes, où en est le projet, les liens |
| `Fiche-une-page_…png` | la même page en image, pour un message ou un aperçu |
| `Textes-de-publication_….docx`, `….md` | l'annonce, le commentaire des liens, le rappel, le message court (280 caractères), l'annonce pour une communauté technique, le courriel d'invitation, le texte alternatif de la vidéo, cinq phrases d'accroche — et le mode d'emploi |

## Les règles du kit

Ce sont celles du film ([VIDEO.md](VIDEO.md)), tenues par `tests/node/launch_kit.test.mjs` :

- **Chaque phrase est quelque chose que l'outil fait.** Le fil est celui du film : une pièce commence par une question —
  à quoi sert-elle ? — et l'outil est celui qui retient la réponse, du premier besoin à la commande.
- **Aucun chiffre de gain.** Personne n'a mesuré de temps gagné : ni pourcentage, ni « n fois plus », ni « plus vite ».
  L'outil refuse d'écrire un kit qui en donne un (`gainClaims`), et le mode d'emploi demande de ne pas en ajouter.
- **Le projet est dit tel qu'il est** : logiciel libre (licence MIT), en développement actif, démonstration en ligne
  **sur demande**. Aucune promesse que personne ne peut tenir (« révolutionnaire », « le meilleur »).
- **La voix raconte, elle ne lit pas l'écran** : les répliques de la bande-annonce passent le même essai que celles du
  film (`readsScreen`).
- **Deux langues partout**, et **aucune marque d'un autre produit** dans ce qui se publie ; pas de nom de personne
  vivante.
- **Visuel, symbole, couleur** : la fiche range ce que fait l'outil en trois groupes par nature — Concevoir, Vérifier,
  Livrer —, chacun sa couleur, chaque étape un pictogramme de l'application et un titre court.

## La bande-annonce : une coupe du film

Elle n'est pas dessinée de nouveau. `tools/film/teaser.mjs` dit quels plans du film la composent — sept plans, de la
phrase d'ouverture à la marque — et ce que la voix raconte par-dessus, en sept souffles. `tools/film_teaser.mjs` coupe
ces plans dans un film déjà rendu (son image seule), fait dire les répliques et pose les sous-titres à côté :

```bash
NODE_USE_ENV_PROXY=1 node tools/film_teaser.mjs make <voix> fr web/video/designwizard_fr.mp4 <dossier>/teaser_fr.mp4
```

Le film donné est celui de la même langue (ce qu'il écrit à l'écran est dans cette langue). **Quand l'image du film
change, la bande-annonce se refait par la même commande** : les répliques, gardées dans le dossier de travail, ne sont
pas redemandées. `--dry` essaie le montage sans voix. Seul le texte des répliques part chez le service de voix ; la clé
n'est jamais dans le dépôt.

## La fiche et les textes

Les mots sont à un seul endroit, `tools/launch/content.mjs` (la fiche, les textes, les phrases d'accroche, le mode
d'emploi) ; la page est `tools/launch/sheet.mjs` — le papier quadrillé, l'encre, les pictogrammes et la marque de la
plateforme. `tools/launch_kit.mjs` écrit tout :

```bash
node tools/launch_kit.mjs <dossier> --date 2026-11-18 --teaser-fr <dossier>/teaser_fr.mp4 --teaser-en <dossier>/teaser_en.mp4
```

La fiche est imprimée en PDF par le Chromium de la séance ; l'outil s'arrête si elle déborde de sa page. Le document
Word des textes est écrit par l'écrivain de la plateforme (`core/docx.js`), au gabarit de ses documents.

## Ce qui est vérifié, ce qui ne l'est pas

Vérifié : les règles ci-dessus, par les essais ; la fiche, relue à l'œil dans les deux langues (une page, rien ne
déborde, polices incorporées) ; le montage de la bande-annonce, une image par plan ; la durée de chaque réplique dans
son plan (aucune n'est accélérée de plus de 4 %).

La bande-annonce a été recoupée du film refait à la v0.99 (écrans d'aujourd'hui, le Rover par modules) : mêmes
répliques, nouvelle image.

Pas vérifié : **la voix de la bande-annonce à l'oreille** — personne ne l'a écoutée (prononciation de
« DynamiteOrbit », ton) ; l'anglais par quelqu'un dont c'est la langue ; l'accueil réel des textes sur un réseau ;
la règle « les liens en premier commentaire », qui est un usage courant et non une mesure. L'image de la bande-annonce
est celle du film : elle se met à jour avec lui.
