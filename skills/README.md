# Skills partageables

Ce dossier contient ce que DesignWizard.ai peut prêter à d'autres projets bâtis avec un agent.

## `ergonomie-ui` — ergonomie d'interface et façon de travailler avec l'agent

Les règles trouvées en construisant cette application, écrites pour qu'un autre projet naisse avec : le contrat de
travail humain–agent, l'interface honnête, les mécanismes dont tout écran hérite, l'aller-retour IA. Chaque règle dit
si c'est un usage établi ou un choix maison, et pourquoi elle existe.

Le même contenu, sous deux formes :

| Forme | Fichier | Pour qui |
|---|---|---|
| Fichier unique | [`ergonomie-ui.md`](ergonomie-ui.md) | À joindre à n'importe quelle conversation avec Claude : « applique ces règles à mon projet ». Rien à installer. |
| Skill | [`ergonomie-ui/`](ergonomie-ui/) | L'agent le charge de lui-même quand la tâche s'y prête. Un `SKILL.md` court et quatre annexes lues au besoin. |

### S'en servir

- **Dans un chat** : joindre `ergonomie-ui.md` et dire ce que l'on veut en faire.
- **Dans un dépôt, avec Claude Code** : copier le dossier `ergonomie-ui/` dans `.claude/skills/` du dépôt (ou dans
  `~/.claude/skills/` pour tous ses projets).
- **Dans l'application Claude** : importer le fichier `ergonomie-ui.skill` dans les réglages des skills, si votre
  organisation le permet. Ce fichier est le dossier empaqueté (une archive du `SKILL.md` et de ses annexes) ; il
  n'est pas gardé dans le dépôt : on le produit avec l'outil d'empaquetage des skills, ou on le demande à son agent.

Les deux derniers points suivent la documentation de Claude au moment de l'écriture : vérifier celle de votre
version.

### Le modifier

La source est le dossier `ergonomie-ui/`. Le fichier unique est généré : `node tools/gen_skill_file.mjs` (un test
vérifie qu'il est à jour). Le dossier `evals/` contient deux demandes d'essai, pour vérifier qu'un agent qui reçoit
le skill sait quoi en faire.

Licence MIT, comme le reste du dépôt.
