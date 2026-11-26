# Cartes de révision piano

Cartes à imprimer au format carte à collectionner (63 × 88 mm, 9 par feuille A4)
pour apprendre à lire les notes sur la portée et à les trouver sur le clavier.

Chaque carte est coupée en deux : la **question en haut**, la **réponse en bas**
(sur fond gris). On cache le bas avec la main, on répond dans sa tête, on vérifie.

## Utilisation

Ouvrir `index.html` dans un navigateur (double-clic, aucune installation ni serveur).

- **Exercices** : choisir les types de cartes à afficher.
- **Clés** : clé de sol et/ou clé de fa.
- **Dièses et bémols** : ajoute les notes altérées (désactivé par défaut).
- **Mélanger / Trier** : change l'ordre des cartes.
- **Imprimer** : lance l'impression.

Les choix sont mémorisés dans le navigateur.

### Réglages d'impression

- Papier **A4**, orientation portrait.
- Échelle **100 %** (« taille réelle »), et non « ajuster à la page », sinon les cartes ne feront plus 63 × 88 mm.
- Cocher **« graphiques d'arrière-plan »** pour garder le fond gris des réponses.
- Découper le long des traits gris.

## Les exercices

| Code | Exercice           | Question                               | Réponse                                          |
|------|--------------------|----------------------------------------|--------------------------------------------------|
| A    | Portée → nom       | une note sur la portée                 | son nom + sa position (« 2e ligne »)             |
| B    | Clavier → nom      | une touche colorée sur un clavier      | son nom + un repère (« entre les 2 touches noires ») |
| C    | Portée → clavier   | une note sur la portée                 | la touche sur le clavier (le point gris = do central) |
| D    | Nom → portée       | un nom de note et une clé              | où elle se place sur la portée                   |
| E    | Note avant / après | un nom de note (« Sol »)               | la note d'avant et d'après (« Fa », « La ») + la gamme autour |

Notes utilisées :

- exercices C et D : uniquement sur les 5 lignes de la portée, de Mi à Fa en clé de sol et de Sol à La en clé de fa ;
- exercice A : quelques notes en plus hors de la portée :
  - clé de sol : Do (do central, ligne supplémentaire) et Ré (sous la portée), Sol (au-dessus de la portée) ;
  - clé de fa : Si (au-dessus de la portée) et Do (do central, ligne supplémentaire).

| Sélection                     | Cartes | Pages A4 |
|-------------------------------|-------:|---------:|
| Tout, notes naturelles        |     76 |        9 |
| Tout, avec dièses et bémols   |    165 |       19 |

Le numéro en bas à droite de chaque carte (A01, B07…) permet de les ranger.

## Jeu d'entraînement (téléphone)

Le dossier `jeu/` contient une petite appli d'entraînement façon Duolingo, à
installer sur le téléphone (application web installable, utilisable hors connexion).

- On coche les exercices (A à E), les clés, les options, puis « Commencer ».
- Seule la question est affichée ; on répond en touchant :
  - A, B : le nom de la note (et dièse / bémol si l'option est activée) ;
  - C : la touche sur le clavier ;
  - D : la ligne ou l'interligne sur la portée ;
  - E : la note d'avant puis celle d'après.
- « Vérifier » corrige en vert / rouge, joue la note et explique la réponse.
- Une question ratée revient en fin de séance. Les questions souvent ratées
  sortent plus souvent les fois suivantes.
- Points (XP), série de bonnes réponses, jours d'entraînement d'affilée,
  liste « À revoir » en fin de séance. Tout est enregistré sur le téléphone.

Sur ordinateur, ouvrir `jeu/index.html` suffit pour jouer. Pour l'installer sur
le téléphone, le site doit être en ligne (en HTTPS), puis :

- Android (Chrome) : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil » ;
- iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil ».

Après une modification du jeu, changer `CACHE` dans `jeu/sw.js` (ex. `piano-jeu-v2`)
force les téléphones à tout recharger ; sinon la nouvelle version arrive au lancement suivant.

## Organisation du code

- `index.html`: la page.
- `css/cartes.css`: mise en page écran et impression.
- `js/glyphes.js`: tracés des symboles musicaux (clés, notes, altérations).
- `js/musique.js`: noms des notes, clés, positions sur la portée.
- `js/dessin.js`: génération des images SVG (portée, clavier).
- `js/cartes.js`: définition des cartes de chaque exercice.
- `js/app.js`: filtres, mélange, découpage en pages.
- `jeu/index.html`, `jeu/jeu.css`: écrans du jeu.
- `jeu/exercices.js`: questions possibles, tirage, vérification des réponses (sans affichage).
- `jeu/jeu.js`: interactions, sons, progression.
- `jeu/sw.js`, `jeu/manifest.webmanifest`, `jeu/icones/`: installation sur téléphone et mode hors connexion.

Le jeu réutilise `js/glyphes.js`, `js/musique.js` et `js/dessin.js` : les dessins
sont les mêmes que sur les cartes.

## Crédits

Symboles musicaux extraits de la police [Bravura](https://github.com/steinbergmedia/bravura)
© Steinberg Media Technologies GmbH, sous licence SIL Open Font License 1.1
(voir `licences/Bravura-OFL.txt`).
