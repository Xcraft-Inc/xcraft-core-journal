# 📘 xcraft-core-journal

## Aperçu

`xcraft-core-journal` est une bibliothèque utilitaire du framework Xcraft assurant la **journalisation persistante des logs** applicatifs. Elle s'abonne automatiquement au système de logging Xcraft (`xcraft-core-log`) et retranscrit chaque message émis dans un fichier journal sur disque, avec rotation automatique par taille et par intervalle, compression des archives et purge des fichiers les plus anciens. Ce module garantit ainsi une trace exploitable et durable de l'activité d'un processus Xcraft, tout en maîtrisant l'espace disque utilisé.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Variables d'environnement](#variables-denvironnement)
- [Détails des sources](#détails-des-sources)
- [Licence](#licence)

## Structure du module

Le module expose une unique fonction de fabrique (`module.exports = (xLog) => new Journal(xLog)`) qui instancie une classe `Journal`. Cette classe :

- Charge la configuration Xcraft via [xcraft-core-etc] pour déterminer le répertoire racine (`xcraftRoot`) où seront stockés les logs.
- S'abonne à tous les niveaux de log exposés par l'instance `xLog` reçue en paramètre.
- Crée et maintient un flux d'écriture rotatif (`rotating-file-stream`) par processus, identifié par le nom du fichier principal du processus.
- Écrit chaque message reçu dans le fichier journal courant, au format texte simple.

Un registre global (`streams`), partagé entre toutes les instances de `Journal` au sein d'un même processus Node.js, garantit qu'un seul flux de fichier est ouvert par processus, même si plusieurs instances de `Journal` sont créées.

## Fonctionnement global

Le cycle de vie du journal se déroule ainsi :

1. **Configuration** : à la construction, `Journal` charge la configuration `xcraft` (via [xcraft-core-etc]) pour obtenir `xcraftRoot`, puis calcule le chemin du répertoire de logs : `{xcraftRoot}/var/log/xcraft`.
2. **Abonnement aux logs** : la classe parcourt `xLog.getLevels()` et enregistre un écouteur pour chaque niveau disponible (par exemple `info`, `warn`, `err`, etc.), chaque écouteur appelant `this.log(level, msg)`.
3. **Identification du processus** : le module dérive un identifiant de processus (`this._id`) à partir de `require.main?.filename` (nom de base du fichier). Si cette valeur n'est pas disponible — cas des versions d'Electron supérieures à 27 où l'ESM est utilisé par défaut — un identifiant de repli `'host'` est utilisé.
4. **Réutilisation du flux** : si un flux existe déjà dans le registre global pour cet identifiant de processus, la construction s'arrête ici (le flux existant sera réutilisé par toutes les instances).
5. **Création du flux rotatif** : sinon, un nouveau flux est créé via `rotating-file-stream`, nommé `xcraft.{id}.log`, avec rotation à 1 Mo ou toutes les 24 heures, compression gzip des fichiers archivés et conservation d'un maximum de 50 fichiers.
6. **Écriture** : à chaque message de log reçu, la méthode `log(mode, msg)` écrit une ligne formatée dans le flux courant : horodatage, nom du module émetteur, niveau et message.
7. **Résilience** : toute erreur survenant lors de la création du flux ou de l'écriture est interceptée et journalisée uniquement via `console.error`, jamais via `xLog`, afin d'éviter une boucle de rétroaction (effet Larsen) si l'erreur provenait elle-même du système de log.

```
xLog (émetteur d'événements)
      │
      ├─ abonnement par niveau (info, warn, err, ...)
      ▼
   Journal.log(mode, msg)
      │
      ▼
  flux rotating-file-stream
      │
      ▼
 var/log/xcraft/xcraft.{id}.log
      │ (rotation par taille/intervalle)
      ▼
 archives .gz (max 50 fichiers)
```

## Exemples d'utilisation

### Initialisation du journal

```javascript
const xLog = require('xcraft-core-log')('myModule');
const xJournal = require('xcraft-core-journal')(xLog);

// Chaque appel sur xLog est automatiquement répercuté dans le fichier journal
xLog.info('Application démarrée');
xLog.warn('Connexion lente détectée');
xLog.err("Échec d'authentification pour user123");
```

### Structure des fichiers générés

```
var/log/xcraft/
├── xcraft.host.log                       # Fichier actuel
├── 20250613-0936-01-xcraft.host.log.gz   # Archive compressée
├── 20250613-0936-02-xcraft.host.log.gz   # Archive plus ancienne
└── ...
```

### Format d'une ligne de log

```
2024-01-15T10:30:45.123Z [myModule] info: Application démarrée
```

## Interactions avec d'autres modules

- **[xcraft-core-etc]** : fournit la configuration `xcraft` (notamment `xcraftRoot`) utilisée pour localiser le répertoire de logs.
- **[xcraft-core-log]** : fournit l'instance `xLog` dont les événements (`getLevels()`) sont écoutés par `Journal` ; c'est la source de tous les messages journalisés.
- **rotating-file-stream** (dépendance tierce, hors écosystème Xcraft) : assure la rotation, la compression et la rétention des fichiers de log.

Ce module est généralement instancié une seule fois par processus, tôt dans le cycle de démarrage d'une application Xcraft, afin de capturer l'ensemble des logs émis par la suite.

## Variables d'environnement

| Variable     | Description                                                                                                                                                     | Exemple       | Valeur par défaut                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| `xcraftRoot` | Répertoire racine Xcraft, chargé via la configuration `xcraft` ([xcraft-core-etc]). Sert de base au chemin `var/log/xcraft` où sont écrits les fichiers de log. | `/opt/xcraft` | Dépend de la configuration Xcraft active |

## Détails des sources

### `lib/index.js`

Ce fichier unique contient toute la logique du module, portée par la classe `Journal`.

#### Mécanisme de persistance et formats de données

- **Stockage** : les logs sont écrits en texte brut, ligne par ligne, dans un fichier nommé `xcraft.{id}.log` situé sous `{xcraftRoot}/var/log/xcraft/`.
- **Rotation** : déclenchée dès que le fichier atteint 1 Mo ou que 24 heures se sont écoulées, selon la première condition atteinte.
- **Compression** : les fichiers rotés sont automatiquement compressés au format gzip.
- **Rétention** : au maximum 50 fichiers sont conservés ; les plus anciens sont supprimés automatiquement par `rotating-file-stream`.
- **Format d'une entrée** : `{horodatage ISO} [{nom du module}] {niveau}: {message}`.

#### Gestion des erreurs et cas particuliers

- Si la création du flux échoue (par exemple, répertoire inaccessible), l'exception est interceptée, affichée via `console.error` (jamais via `xLog`, pour éviter une boucle de rétroaction), et aucune écriture n'est possible pour ce processus.
- Si une erreur survient sur le flux après sa création (événement `error`), l'entrée correspondante est supprimée du registre global `streams`, ce qui désactive silencieusement la journalisation pour ce processus.
- Toute erreur d'écriture (`stream.write`) est également interceptée et journalisée uniquement via `console.error`.
- Sous Electron version supérieure à 27 (où l'ESM est utilisé par défaut), `require.main?.filename` peut être indéfini ; l'identifiant de processus se replie alors sur la valeur `'host'`.

#### Performances et limites

- Un seul flux d'écriture est maintenu par processus grâce au registre global `streams`, évitant toute contention entre plusieurs instances de `Journal`.
- La taille de rotation relativement faible (1 Mo) favorise des fichiers courts et rapides à consulter, au prix d'un nombre potentiellement élevé d'archives compressées en cas de forte activité.
- Le module ne propose pas de mécanisme de purge basé sur l'ancienneté au-delà du nombre de fichiers (`maxFiles: 50`) ; en cas de très forte volumétrie, la rétention réelle en jours peut donc varier.

#### Méthodes publiques

- **`log(mode, msg)`** — Écrit un message dans le flux rotatif courant, au format standardisé incluant l'horodatage, le nom du module source, le niveau (`mode`) et le contenu (`msg.message`). Ne fait rien si aucun flux n'est disponible pour le processus courant.

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

_Ce contenu a été généré par IA_

---

[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-log]: https://github.com/Xcraft-Inc/xcraft-core-log
