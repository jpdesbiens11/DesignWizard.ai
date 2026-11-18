# Des mécanismes dont tout écran hérite

## Le principe

Une règle d'ergonomie écrite écran par écran se perd au troisième écran. Chaque règle ci-dessous est portée par **un
seul mécanisme**, installé une fois au démarrage de l'application, qui reconnaît les écrans à leur structure. Un
nouvel écran n'a rien à déclarer : il en hérite parce qu'il est fait comme les autres.

Comment bâtir un tel mécanisme :

- **Une convention de structure**, pas une inscription : « un groupe est une section dont le premier enfant est son
  titre », « un volet est `.side`, ce qui défile `.side-scroll` », « un champ numérique est un champ numérique
  ordinaire ».
- **Des écoutes déléguées** au niveau du document, et un observateur des changements de la page : un volet redessiné
  est repris avant d'être peint.
- **Deux moitiés** : la logique pure (clés, géométrie, états), testée sans page ; la moitié qui touche l'écran.
- **Un attribut pour ce que l'écran sait de plus**, facultatif (ce que contient un groupe replié, un outil qui garde
  un geste pour lui).
- **Une seule source** pour chaque contrôle commun (l'interrupteur, le voile, le menu) : jamais deux versions.

Chaque fiche dit : ce que voit l'utilisateur · **usage établi** ou **choix maison** · ce que doit faire un nouvel
écran. Les fiches marquées « usage établi » ne sont pas des inventions : elles sont réunies ici, et tenues.

## Sommaire

1. La structure d'un écran de travail · 2. Les volets · 3. Les listes et les arbres · 4. Les champs ·
5. On / Off, copies et variantes · 6. Ce que montre le centre · 7. La vue 3D · 8. Le menu d'un élément ·
9. Ce qui dure · 10. Annuler · 11. Mots et unités · 12. La page qui reste ouverte

## 1. La structure d'un écran de travail — choix maison

Trois zones, toujours les mêmes : **à gauche ce que l'on entre, au centre ce que l'on regarde, à droite ce que l'on
choisit et ce que l'on obtient**. Les deux volets se redimensionnent et se cachent ; leur largeur est la même d'un
écran à l'autre. *Nouvel écran : reprendre ces trois zones, même s'il en laisse une vide.*

## 2. Les volets

- **Groupes repliables — usage établi.** Un clic sur le titre d'un groupe le replie (chevron vers la droite) et fait
  remonter les suivants ; Alt + clic n'en garde qu'un ouvert ; un bouton replie tout ; l'état est gardé. Un groupe
  replié dit en quelques mots ce qu'il contient, et **passe en ambre s'il attend encore une valeur** ; le guide
  rouvre le groupe où il envoie. *Nouvel écran : donner un titre à chaque groupe.*
- **Le volet reste où il était — usage établi.** Redessiné après une valeur, il garde sa position de défilement et
  le curseur dans son champ ; après Tab, dans le champ suivant. *Rien à faire.* (Une plainte typique quand ce n'est
  pas tenu : « chaque fois que je fais Entrée, ça remonte en haut ».)
- **Ce que l'on fait reste en haut — usage établi.** Le bouton qui lance et la bascule de vue sont épinglés en tête
  du volet : ils ne défilent pas. Le résultat vient avant l'explication. *Nouvel écran : mettre ses actions dans la
  zone épinglée, pas au bout du volet.*

## 3. Les listes et les arbres

- **Jamais une longue liste de texte seule — choix maison.** Tout choix se présente groupé par nature, une couleur
  par groupe, un pictogramme qui montre le concept et un titre court par élément ; le détail vient après.
- **Un arbre porte des numéros et des couleurs qui servent partout — usage établi.** L'élément A1 de la liste est
  A1 sur l'étiquette de la vue et dans le message du guide, de la même couleur. Un clic dans la liste l'allume dans
  la vue, et l'inverse.
- **Les réglages courants restent sur la ligne** (l'interrupteur, l'œil) ; le reste va dans le menu de la ligne.

## 4. Les champs

- **Flèches à vitesse progressive — choix maison.** Dans tout champ numérique, une flèche ajoute ou retire 1 ;
  tenue ou cliquée vite, elle accélère (×2, ×5, ×10) et un témoin dit la vitesse. N'importe quelle décimale se tape.
  *Nouvel écran : un champ numérique ordinaire ; ne pas refaire ses propres flèches.*
- **Entrée valide, Échap abandonne, Tab passe au suivant** — usage établi, à tenir même quand l'écran se redessine.

## 5. On / Off, copies et variantes — usage établi (la « suppression » et les « configurations » de la CAO)

- **Off = mis de côté.** L'entrée reste dans le modèle avec ses valeurs et **ne compte pour rien** : ni pour le
  calcul, ni pour ce qui s'affiche, ni pour le guide, ni pour ce qui sort. On la ramène telle quelle.
- **Dupliquer fait une copie née à Off**, juste après l'original : on y change une valeur, on la met à On à sa
  place, on relance, on compare. Un geste (Alt + clic) met une entrée seule à On parmi celles de son type.
- **Le même interrupteur partout** ; ce qui est à Off est grisé et le dit ; chaque titre compte ce qui est à On et à
  Off.
- **Tout ce qui lit le modèle passe par « ce qui compte »** : une seule fonction rend le modèle sans ce qui est à
  Off, et chaque outil la prend. *C'est le point qui se rate : un seul lecteur oublié, et Off ment.*
- **Variantes nommées** : l'état du modèle (ce qui est à On, la valeur de chaque paramètre) se garde sous un nom, et
  un clic y revient, en une étape annulable. Chaque variante dit ce que le clic changerait.

## 6. Ce que montre le centre — usage établi

- **Tout se zoome** : vue 3D et plan à la molette vers le pointeur ; feuille par Ctrl + molette (la molette seule
  fait défiler) avec une petite barre − / % / + ; glisser pour déplacer ce qui dépasse.
- **Une loupe** dans la barre commune : une lentille suit le pointeur sur tout dessin ou vue, facteur réglable par
  un court curseur ; le pointeur agit au travers ; Échap la range. Le vectoriel est retracé à l'échelle.

## 7. La vue 3D — usage établi, sauf la rotation automatique

- **Le pivot est le point saisi** : la vue tourne autour du point sous le pointeur à l'appui ; ce que l'on tient
  reste en place à l'écran.
- **Trois axes, aucune butée** : gauche / droite autour de la verticale du modèle, haut / bas autour de
  l'horizontale de l'écran (et par-dessus), une touche pour le roulis. La pièce suit la main, dans tous les sens.
  *Piège vécu : une vue de dessus où gauche / droite « ne fait rien » — il faut garder le haut de l'écran d'un geste
  au suivant, la direction du regard ne suffit pas.*
- **Un repère pendant le geste** : le pivot, l'axe, un arc et une flèche, les angles parcourus.
- **Rotation automatique — choix maison** : le bouton tenu deux secondes ouvre un petit panneau (sens, vitesse). Un
  interrupteur par axe : deux ou trois sens vont ensemble, chacun avec sa flèche qui tourne dans le repère.
- Un outil qui attend un clic dans la vue garde le geste pour lui, et le dit au mécanisme.

## 8. Le menu d'un élément — usage établi

Un clic droit sur une ligne ouvre **le même menu** que sur l'élément dans la vue : une seule fonction le construit,
d'après l'état de l'élément (« Montrer seulement cette pièce » devient « Montrer toutes les pièces »). Au clavier,
il s'ouvre sous la ligne.

## 9. Ce qui dure — usage établi

Toute opération qui peut durer montre le même voile : ce qui se fait, une ligne de progression, le temps écoulé,
**un mot quand rien n'avance**, un bouton « Annuler » qui arrête vraiment, puis « Reprendre ». L'écran n'est jamais
figé sans dire pourquoi. *Nouvelle opération longue : naît avec son voile et son annulation.*

## 10. Annuler — usage établi

Chaque changement est **une étape annulable, avec son nom** (« Longueur = 176 », « Variante Longue »). Un geste qui
change plusieurs choses d'un coup est une seule étape.

## 11. Mots et unités — choix de domaine

- Les termes du métier se montrent comme le métier les nomme ; un glossaire donne l'équivalent.
- Les valeurs sont gardées dans un seul système ; l'écran écrit dans le système choisi, par une seule fonction de
  mise en forme. Ce qui doit rester dans une unité (un calcul, un fichier de fabrication) le dit.

## 12. La page qui reste ouverte — usage établi

Une application d'une seule page, gardée ouverte des heures, ne reçoit pas ce qui est publié entre-temps. Elle lit
de temps en temps la version publiée et **propose de se mettre à jour** : enregistrer, redemander ses fichiers,
recharger. Sinon la personne cherche un bouton que sa page n'a pas encore.
