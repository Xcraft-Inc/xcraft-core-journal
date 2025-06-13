# 📘 Documentation du module xcraft-core-journal

## Aperçu

Le module `xcraft-core-journal` est un système de journalisation avancé pour le framework Xcraft qui gère l'écriture persistante des logs dans des fichiers rotatifs. Il capture automatiquement tous les messages de log émis par le système de logging Xcraft et les sauvegarde dans des fichiers compressés avec rotation automatique.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Variables d'environnement](#variables-denvironnement)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module est composé d'une classe principale `Journal` qui :

- S'abonne aux événements de logging du système Xcraft
- Gère la création et la rotation des fichiers de log
- Utilise `rotating-file-stream` pour la gestion avancée des fichiers
- Maintient un registre global des streams de fichiers par processus

## Fonctionnement global

Le journal fonctionne selon le principe suivant :

1. **Initialisation** : À la création, le journal s'abonne à tous les niveaux de log disponibles dans le système Xcraft
2. **Capture** : Chaque message de log émis déclenche automatiquement l'écriture dans le fichier correspondant
3. **Rotation** : Les fichiers sont automatiquement rotés selon la taille (1MB) et l'intervalle (1 jour)
4. **Compression** : Les anciens fichiers sont compressés en gzip pour économiser l'espace
5. **Rétention** : Un maximum de 50 fichiers est conservé avant suppression automatique

Le système utilise un pattern singleton par processus pour éviter les conflits d'écriture sur les mêmes fichiers. L'identification des processus se base sur le nom du fichier principal (`require.main?.filename`) avec un fallback sur 'host' pour les environnements Electron > 27 où ESM est utilisé par défaut.

## Exemples d'utilisation

### Initialisation du journal

```javascript
const xLog = require('xcraft-core-log')('myModule');
const xJournal = require('xcraft-core-journal')(xLog);

// Le journal capture automatiquement tous les logs
xLog.info("Message d'information");
xLog.warn("Message d'avertissement");
xLog.err("Message d'erreur");
```

### Structure des fichiers générés

```
var/log/xcraft/
├── xcraft.host.log                       # Fichier actuel
├── 20250613-0936-01-xcraft.host.log.gz   # Rotation précédente
├── 20250613-0936-02-xcraft.host.log.gz   # Plus ancienne
├── 20250613-0824-01-xcraft.host.log.gz   # Plus ancienne
└── ...
```

### Format des messages dans les fichiers

```
2024-01-15T10:30:45.123Z [myModule] info: Application démarrée
2024-01-15T10:30:46.456Z [database] warn: Connexion lente détectée
2024-01-15T10:30:47.789Z [auth] err: Échec d'authentification pour user123
```

## Interactions avec d'autres modules

Le module interagit étroitement avec :

- **[xcraft-core-etc]** : Pour la configuration et la localisation du répertoire de logs
- **[xcraft-core-log]** : Pour l'écoute des événements de logging
- **rotating-file-stream** : Pour la gestion avancée des fichiers rotatifs

## Variables d'environnement

| Variable     | Description                                    | Exemple       | Valeur par défaut          |
| ------------ | ---------------------------------------------- | ------------- | -------------------------- |
| `xcraftRoot` | Répertoire racine Xcraft (via xcraft-core-etc) | `/opt/xcraft` | Dépend de la configuration |

## Détails des sources

### `lib/index.js`

Ce fichier contient la classe principale `Journal` qui implémente le système de journalisation persistante.

#### Fonctionnalités principales

- **Gestion des streams globaux** : Utilise un objet `streams` global pour éviter la duplication des flux de fichiers par processus
- **Auto-abonnement** : S'abonne automatiquement à tous les niveaux de log disponibles
- **Identification des processus** : Utilise le nom du fichier principal pour identifier chaque processus avec fallback pour Electron
- **Gestion d'erreurs robuste** : Évite les boucles infinies (effet Larsen) en utilisant `console.error` pour les erreurs internes

#### Configuration de la rotation

- **Taille maximale** : 1MB par fichier
- **Intervalle** : Rotation quotidienne
- **Rétention** : 50 fichiers maximum
- **Compression** : gzip pour les fichiers archivés
- **Répertoire** : `{xcraftRoot}/var/log/xcraft/`

#### Méthodes publiques

- **`log(mode, msg)`** — Écrit un message de log dans le fichier rotatif avec le format standardisé incluant timestamp, module source, niveau et message.

#### Gestion des erreurs

Le module implémente une gestion d'erreurs défensive :

- Les erreurs de création de stream suppriment l'entrée du registre global
- Les erreurs d'écriture sont loggées via `console.error` pour éviter les boucles
- Les exceptions sont capturées pour maintenir la stabilité du système
- Protection contre l'effet Larsen en évitant d'utiliser xLog pour les erreurs internes

#### Particularités techniques

Le module gère spécifiquement le cas d'Electron version 27+ où ESM est utilisé par défaut, ce qui peut affecter la disponibilité de `require.main.filename`. Dans ce cas, un fallback sur 'host' est utilisé pour l'identification du processus.

---

_Ce document a été mis à jour pour refléter l'état actuel du code source._

[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-log]: https://github.com/Xcraft-Inc/xcraft-core-log