import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";

const Datenschutz = () => {
  return (
    <Layout>
      <div className="container-wide py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-8">
            Datenschutz
          </h1>

          <div className="prose prose-lg max-w-none space-y-8 text-muted-foreground">
            <div>
              <p className="text-lg">
                Wir wissen Ihr Vertrauen sehr zu schätzen!
              </p>
              <p>
                Daher ist uns der Schutz Ihrer Daten, Ihrer Persönlichkeitsrechte sowie die Beachtung Ihres Rechts auf informationelle Selbstbestimmung bei der Erhebung, Verarbeitung und Nutzung Ihrer persönlichen Daten ein wichtiges Anliegen. Unsere Datenschutzpraxis steht im Einklang mit dem Bundesdatenschutzgesetz (BDSG) sowie den darüber hinaus geltenden gesetzlichen Bestimmungen.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Zweck der Erhebung und Verwendung Ihrer Daten</h2>
              <p>
                Die Private Shirt GmbH hat sich auf die Bedruckung qualitativ hochwertiger Textilien und Accessoires spezialisiert. Wir speichern und verwenden die von Ihnen mitgeteilten Daten zur Erfüllung und Abwicklung Ihrer Bestellung. Die Private Shirt GmbH gibt keine personenbezogenen Kundendaten an Dritte weiter. Ausgenommen hiervon sind Dienstleistungspartner, die zur Vertragsabwicklung die Übermittlung von Daten erfordern. In diesen Fällen beschränkt sich der Umfang der übermittelten Daten jedoch auf das erforderliche Minimum. Wir speichern den Vertragstext und senden Ihnen die Bestelldaten per E-Mail zu. Die AGB können Sie jederzeit hier (<a href="http://private-shirt.com/de/AGB" className="text-primary hover:underline">http://private-shirt.com/de/AGB</a>) einsehen. Vergangene Bestellungen können Sie in Ihrem Kundenkonto einsehen.
              </p>
              <p className="mt-4">
                Sollten Sie Ihre Unterlagen verlieren, wenden Sie sich bitte an unseren Kundenservice. Wir senden Ihnen gerne eine Kopie Ihrer Bestellung zu.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Keine Weitergabe Ihrer Daten an Dritte für Werbezwecke</h2>
              <p>
                Die Private Shirt GmbH wird die personenbezogenen Kundendaten nicht zum Zwecke der Werbung oder Markt- und Meinungsforschung weitergeben. Wenn Sie sich für den Private Shrit Newsletter angemeldet haben, verwendet Private Shirt Ihre bei der Registrierung angegebenen Daten um Zweck der Zusendung des Private Shirt Newsletters. Es erfolgt keine Weitergabe Ihrer Daten an Dritte. Unsere Datenschutzbestimmungen stehen im Einklang mit dem Bundesdatenschutzgesetz (BDSG) und dem Telemediengesetz (TMG). Darüber hinaus können Sie uns aktiv eine differenzierte Erlaubnis erteilen, dass Ihnen von Zeit zu Zeit besonders auf Sie abgestimmte Produktinformationen und Werbung von der Private Shirt GmbH an Ihre bei der Bestellung angegebenen Adressdaten postalisch und/oder per E-Mail unter Wahrung Ihrer schutzwürdigen Interessen zugesandt werden. Die Möglichkeit zur Erlaubniserteilung finden Sie u.a. im Rahmen des Anmeldeprozesses bei Ihrer ersten Bestellung. Die Abmeldung ist jederzeit möglich. Sie können der Verwendung Ihrer Daten jederzeit mittels in den Mailings enthaltenem Abmeldelink oder per E-Mail an <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a> widersprechen, ohne dass hierfür andere als die Übermittlungskosten nach den Basistarifen entstehen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Datenverwendung für E-Mail-Werbung ohne Newsletter-Anmeldung und Ihr Widerspruchsrecht</h2>
              <p>
                Wir sind im Rahmen der gesetzlichen Erlaubnis nach § 7 Abs. 3 UWG berechtigt, die E-Mail Adresse, die Sie beim Erwerb einer kostenpflichtigen Leistung angegeben haben, zur Direktwerbung für eigene, ähnliche Produkte oder Dienstleistungen zu nutzen. Falls Sie keine Werbung zu ähnlichen Produkten oder Dienstleistungen mehr erhalten möchten, können Sie der entsprechenden Verwendung Ihrer E-Mail-Adresse jederzeit widersprechen, ohne dass hierfür andere als die Übermittlungskosten nach den Basistarifen entstehen. Dazu können Sie sich per Klick auf den in jedem Mailing enthaltenen Abmeldelink oder per E-Mail an <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a> von den Produktempfehlungen abmelden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Welche Daten erhoben und gespeichert werden</h2>
              <p>
                Es werden Kundendaten (Vor- und Nachname, Firmierung, Anschrift, E-Mail, Telefonnummer, Bankverbindung) unter Beachtung der einschlägigen Vorschriften des Bundesdatenschutzgesetzes (BDSG) und des Telemediengesetzes (TMG) gespeichert und verarbeitet. Persönliche Daten werden ausschließlich zur Abwicklung der Bestellung erfragt, es sei denn, der Kunde wünscht zusätzliche Service-Dienstleistungen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Löschen und Sperren Ihrer Kundendaten</h2>
              <p>
                Der Kunde kann jederzeit eine Löschung seiner Daten erwirken. Er hat ferner das Recht, unter der E-Mail <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a> jederzeit Auskunft über den Stand seiner gespeicherten Daten zu verlangen. Sofern einer Löschung gesetzliche oder vertragliche Aufbewahrungspflichten entgegenstehen, werden die Daten gemäß § 35 Abs. 3 BDSG gesperrt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Hohe Sicherheitsstandards verdienen Vertrauen</h2>
              <p>
                Beim Datentransfer verwenden wir das sogenannte SSL-Sicherheitssystem (Secure Socket Layer) in Verbindung mit einer 128-Bit-Verschlüsselung. Diese Technik bietet höchste Sicherheit und wird daher beispielsweise auch von Banken zum Datenschutz beim Online-Banking eingesetzt. Alle von uns angebotenen Zahlungsarten sind durch die genannten Sicherheitsstandards umfassend geschützt. Dass Ihre Daten verschlüsselt übertragen werden, erkennen Sie an der geschlossenen Darstellung eines Schlüssel- bzw. Schloss-Symbols in der unteren Statusleiste Ihres Browsers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Auf Nummer Sicher gehen mit Private Shirt</h2>
              <p>
                Im Einzelnen sieht unsere Sicherheitsgarantie wie folgt aus: Unsere Software, die den Secure Socket Layer (SSL) als Standard verwendet, verschlüsselt bei einer Bestellung Ihre persönlichen Daten wie Name, Adresse, Bankverbindung und Kreditkartennummer. SSL wird von den meisten Browsern unterstützt. Ihre Daten erreichen unseren Server somit in einem für Unbefugte nicht lesbaren Code.
              </p>
              <p className="mt-4">
                Bisher ist noch keinem Kunden der Private Shirt GmbH ein Schaden entstanden, der auf illegale Nutzung von Kreditkarten- oder Bankinformationen zurückzuführen wäre.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Einsatz von Cookies</h2>
              <p>
                Verschiedene Seiten verwenden Cookies, um den Besuch unserer Website attraktiv zu gestalten und die Nutzung bestimmter Funktionen zu ermöglichen. Hierbei handelt es sich um kleine Textdateien, die auf Ihrem Rechner abgelegt werden. Einige der von uns verwendeten Cookies werden nach Ende der Browser-Sitzung wieder von Ihrer Festplatte gelöscht (sog. Sitzungs-Cookies). Andere Cookies verbleiben auf Ihrem Rechner und ermöglichen uns oder unseren Partnerunternehmen, Ihren Rechner bei Ihrem nächsten Besuch wieder zu erkennen (sog. dauerhafte Cookies). Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden und einzeln über deren Annahme entscheiden oder für bestimmte Fälle oder generell aussetzen. Bei der Nichtannahme von Cookies kann die Funktionalität unserer Webeseite eingeschränkt sein.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Cookies von Google Analytics</h2>
              <p>
                Diese Website benutzt Google Analytics, einen Webanalysedienst der Google Inc. („Google"). Google Analytics verwendet sog. „Cookies", Textdateien, die auf Ihrem Computer gespeichert werden und die eine Analyse der Benutzung der Website durch Sie ermöglichen. Die durch den Cookie erzeugten Informationen über Ihre Benutzung dieser Website werden in der Regel an einen Server von Google in den USA übertragen und dort gespeichert. Im Falle der Aktivierung der IP-Anonymisierung auf dieser Webseite, wird Ihre IP-Adresse von Google jedoch innerhalb von Mitgliedstaaten der Europäischen Union oder in anderen Vertragsstaaten des Abkommens über den Europäischen Wirtschaftsraum zuvor gekürzt. Nur in Ausnahmefällen wird die volle IP-Adresse an einen Server von Google in den USA übertragen und dort gekürzt. Im Auftrag des Betreibers dieser Website wird Google diese Informationen benutzen, um Ihre Nutzung der Website auszuwerten, um Reports über die Websiteaktivitäten zusammenzustellen und um weitere mit der Websitenutzung und der Internetnutzung verbundene Dienstleistungen gegenüber dem Websitebetreiber zu erbringen. Die im Rahmen von Google Analytics von Ihrem Browser übermittelte IP-Adresse wird nicht mit anderen Daten von Google zusammengeführt. Sie können die Speicherung der Cookies durch eine entsprechende Einstellung Ihrer Browser-Software verhindern; wir weisen Sie jedoch darauf hin, dass Sie in diesem Fall gegebenenfalls nicht sämtliche Funktionen dieser Website vollumfänglich werden nutzen können.
              </p>
              <p className="mt-4">
                Sie können darüber hinaus die Erfassung der durch das Cookie erzeugten und auf Ihre Nutzung der Website bezogenen Daten (inkl. Ihrer IP-Adresse) an Google sowie die Verarbeitung dieser Daten durch Google verhindern, indem sie das unter dem folgenden Link verfügbare Browser-Plugin herunterladen und installieren <a href="https://tools.google.com/dlpage/gaoptout?hl=de" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://tools.google.com/dlpage/gaoptout?hl=de</a>.
              </p>
              <p className="mt-4">
                Diese Website verwendet Google Analytics mit der Erweiterung „gat._anonymizeIp();". Damit ist eine direkte Personenbeziehbarkeit der IP-Adresse ausgeschlossen. Weitere Informationen zu Google Analytics und Datenschutz finden Sie unter <a href="https://www.google.com/analytics/learn/privacy.html" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://www.google.com/analytics/learn/privacy.html</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Datenweitergabe über Facebook</h2>
              <p>
                Die Webseite der Private Shrit GmbH verwendet Social Plugins („Plugins") des sozialen Netzwerkes facebook.com, welches von der Facebook Inc., 1601 S. California Ave, Palo Alto, CA 94304, USA betrieben wird („Facebook"). Die Plugins sind an einem der Facebook Logos erkennbar (weißes „f" auf blauer Kachel, ein „Gefällt mir" oder ein „Daumen hoch"-Zeichen) oder sind mit dem Zusatz „Facebook Social Plugin" gekennzeichnet. Die Liste und das Aussehen der Facebook Social Plugins kann eingesehen werden unter: <a href="https://developers.facebook.com/plugins" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://developers.facebook.com/plugins</a>.
              </p>
              <p className="mt-4">
                Wenn Sie eine Webseite unseres Internetauftritts aufrufen, die ein solches Plugin enthält, baut Ihr Browser eine direkte Verbindung mit den Servern von Facebook auf. Der Inhalt des Plugins wird von Facebook direkt an Ihren Browser übermittelt und von diesem in die Webseite eingebunden. Wir haben daher keinen Einfluss auf den Umfang der Daten, die Facebook mit Hilfe dieses Plugins erhebt und informieren Sie daher entsprechend unserem Kenntnisstand:
              </p>
              <p className="mt-4">
                Durch die Einbindung der Plugins erhält Facebook die Information, dass Sie die entsprechende Seite unseres Internetauftritts aufgerufen haben. Sind Sie bei Facebook eingeloggt, kann Facebook den Besuch Ihrem Facebook-Konto zuordnen. Wenn Sie mit den Plugins interagieren, zum Beispiel den Like Button betätigen oder einen Kommentar abgeben, wird die entsprechende Information von Ihrem Browser direkt an Facebook übermittelt und dort gespeichert. Falls Sie kein Mitglied von Facebook sind, besteht trotzdem die Möglichkeit, dass Facebook Ihre IP-Adresse in Erfahrung bringt und speichert.
              </p>
              <p className="mt-4">
                Zweck und Umfang der Datenerhebung und die weitere Verarbeitung und Nutzung der Daten durch Facebook sowie Ihre diesbezüglichen Rechte und Einstellungsmöglichkeiten zum Schutz Ihrer Privatsphäre entnehmen Sie bitte den Datenschutzhinweisen von Facebook: <a href="https://www.facebook.com/policy.php" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://www.facebook.com/policy.php</a>.
              </p>
              <p className="mt-4">
                Wenn Sie Facebook-Mitglied sind und nicht möchten, dass Facebook über unseren Internetauftritt Daten über Sie sammelt und mit Ihren bei Facebook gespeicherten Mitgliedsdaten verknüpft, müssen Sie sich vor Ihrem Besuch unseres Internetauftritts bei Facebook ausloggen. Ebenfalls ist es möglich, Facebook-Social-Plugins mit Add-ons für Ihren Browser zu blocken, zum Beispiel mit dem „Facebook Blocker".
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Verwendung von Youtube</h2>
              <p>
                Wir stellen auf unseren Websites Videos bereit, die auf Youtube.com veröffentlicht sind. Youtube ist eine Tochtergesellschaft der Google Inc., 1600 Amphitheatre Parkway, Mountain View, CA 94043, United States. Zweck und Umfang der Datenerhebung und –nutzung durch Google sowie Ihre Rechte und Einstellungsmöglichkeiten zum Schutz als YouTube-Kunde entnehmen Sie bitte den Datenschutzhinweisen von YouTube (<a href="https://www.youtube.com/t/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://www.youtube.com/t/privacy</a>).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Einblick in Ihre persönlichen Daten</h2>
              <p>
                Ihre eigenen Daten können Sie jederzeit im Bereich „mein Private Shirt" – unter Verwendung Ihrer E-Mail-Adresse und Ihres Passwortes – einsehen, bearbeiten und löschen. Haben Sie Ihr Passwort vergessen, bieten wir Ihnen einen speziellen Service: Im Bereich „mein Private Shrit" finden Sie auf der Log-In-Seite den Link „Haben Sie Ihr Passwort vergessen?", der Sie zur Passwort Hilfe führt. Bitte tragen Sie einfach Ihre bei uns bekannte E-Mail-Adresse ein und senden das Formular ab. Wir senden Ihnen ein Ersatz-Passwort an Ihre E-Mail-Adresse. Dieses Vorgehen ist auch dann risikolos, wenn eine dritte Person versucht, Zugriff auf Ihre Daten zu erlangen. Denn: Die Versendung erfolgt in jedem Fall an Ihre E-Mail-Adresse, auf die nur Sie Zugriff haben.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Ihr Auskunftsrecht</h2>
              <p>
                Sie sind berechtigt, eine unentgeltliche schriftliche Auskunft darüber zu verlangen, welche personenbezogenen Daten die Private Shirt GmbH über Sie gespeichert hat. Nach der Auskunftserteilung etwaige notwendige Berichtigungen, Sperrungen oder Löschungen werden wir – sofern gesetzlich zugelassen – unverzüglich vornehmen. Für Fragen zum Thema Datenschutz schreiben Sie uns bitte über unser Kontaktformular.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Wer ist verantwortliche Stelle für den Umgang mit den Daten?</h2>
              <p>
                Verantwortliche Stelle für die Erhebung, Verarbeitung und Nutzung Ihrer personenbezogenen Daten ist die Private Shirt GmbH, Ballindammm 40, 20095 Hamburg. Bei Fragen zur Erhebung, Verarbeitung oder Nutzung Ihrer personenbezogener Daten, bei Auskünften, Berichtigung, Sperrung oder Löschung von Daten sowie Widerruf erteilter Einwilligungen können Sie uns diese per E-Mail oder Brief an folgende Kontaktdaten senden:
              </p>
              <div className="mt-4 space-y-2">
                <p><strong>Private Shirt GmbH</strong></p>
                <p>Ballindamm 40</p>
                <p>20095 Hamburg</p>
                <p>
                  E-Mail: <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a>
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Datenschutz;

