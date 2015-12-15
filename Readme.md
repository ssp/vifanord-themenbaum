# Vifanord Themenbaum

Dieses Repository enthält verschiedene Schritte und Zwischenstadien für die Konversion des alten vifanord Themenbaums aus der MySQL Datenbank in das neue Format mit der nkwgok TYPO3-Extension. Im Zuge dieser Konversion wurde der Themenbaum auch bereinigt, vereinfacht und leicht umstrukturiert.

Das Resultat der Konversion is die Datei `data/vifanord.csv`, die in der TYPO3-Installation unter `fileadmin/gok/csv/vifanord.csv` abgelegt wird. Das CSV Format ist das der nkwgok TYPO3-Extension mit der Besonderheit, dass in der Abfragespalte ein JSON-Objekt steht. Dieses JSON-Objekt hat die zwei optionale Felder `kiel` und `goe`.

Das Feld `kiel` enthält einen Array von Strings. Die Strings sind Abfragen auf der Kieler Systematik. Zur Abfrage werden sie wenn nötig noch mit Abfragen auf dem Kieler Regionalfeld verknüpft.

Das Feld `goe` enthält ein Objekt, dessen Feldnamen die Kürzel für die einzelnen Länder sind und dessen Feldinhalte die dazugehörige vollständige pazpar2-Abfrage ist.

Beispiel:

	{
		"kiel": ["ska 441.200"],
		"goe": {"fi": "lsg=\"7 pnp 300\""}
	}

Zusätzlich wird die ebenfalls enthaltene CSV Datei `data/regionen.csv` benötigt, die die Daten für die Checkboxen mit den verschiedenen Ländern bereitstellt. Sie wird in der TYPO3-Installation unter `fileadmin/gok/csv/regionen.csv` abgelegt.