import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";

const AGB = () => {
  return (
    <Layout>
      <div className="container-wide py-12 md:py-20">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl lg:text-5xl font-bold text-primary mb-8"
        >
          Allgemeine Geschäfts- und Lieferbedingungen
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="prose prose-lg max-w-none text-foreground"
        >
          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 1 Allgemeines</h2>
          <p>
            Ihr Vertragspartner für alle Bestellungen im Rahmen dieses Online-Angebots ist die Private Shirt GmbH, Ballindamm 40, 20095 Hamburg, Handelsregister Amtsgericht Hamburg, HRB 83191, nachfolgend Private Shirt genannt.
          </p>
          <p>
            Sämtliche Lieferungen von Private Shirt an Kunden erfolgen auf der Grundlage der nachstehenden Allgemeinen Geschäfts- und Lieferbedingungen. Diese liegen allen Angeboten und Vereinbarungen zwischen Private Shirt und dem Kunden zugrunde und gelten für die Dauer der gesamten Geschäftsverbindung als anerkannt. Entgegenstehende oder abweichende Bedingungen des Käufers sind nur dann verbindlich, wenn Private Shirt diese schriftlich anerkannt hat.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 2 Vertragsschluss</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die vom Käufer aufgegebene Bestellung ist ein bindendes Angebot desselben. Private Shirt ist berechtigt, dieses Angebot innerhalb der von uns angegebenen Lieferfristen durch Auslieferung der Ware, gesonderte Auftragsbestätigung (per Fax, E-Mail oder Briefpost) oder in sonstiger geeigneter Weise ganz oder teilweise anzunehmen. Die Eingangsbestätigung stellt keine Auftragsbestätigung dar. Erst ausdrücklichen oder konkludenten Annahmeerklärung von Private Shirt kommt der Kaufvertrag zustande, soweit unsere Annahmeerklärung reicht. Zur Annahme der Angebote der Käufer sind wir nicht verpflichtet.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Der Kunde kann aus dem Private Shirt Sortiment Waren auswählen und diese über den Button „In den Warenkorb" in einem Warenkorb sammeln. Vor dem Absenden der Bestellung durch Anklicken des Buttons „Kaufen" hat der Kunde auf einer Übersichtsseite die Möglichkeit, die Richtigkeit seiner Bestellung zu prüfen und durch Anklicken des jeweiligen Buttons „Bearbeiten" Änderungen vorzunehmen, z.B. Waren zu entfernen oder hinzuzufügen, seine Adresse zu ändern oder die Zahlungsart zu bearbeiten. Dieses Bestellverfahren steht in deutscher Sprache zur Verfügung. Durch das Absenden des ausgefüllten Bestellformulars im Internet gibt der Käufer Private Shirt einen verbindlichen Antrag zum Abschluss eines Kaufvertrages ab.
          </p>
          <p>
            Die Details der Bestellung können auch online unter www.private-shirt.de im Benutzerprofil „Bestellungen" eingesehen werden.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Private Shirt schickt daraufhin dem Kunden eine automatische Empfangsbestätigung per E-Mail zu, die den Eingang der Bestellung bei Private Shirt bestätigt und welche nochmals die Bestellung des Kunden enthält. Diese Empfangsbestätigung stellt keine Annahme des Antrags des Kunden auf Abschluss eines Kaufvertrages dar. Auch stellt diese Empfangsbestätigung keine Bestätigung der Lieferbarkeit der bestellten Ware dar.
          </p>
          <p className="font-semibold">(4)</p>
          <p>
            Der Vertragstext wird von Private Shirt nicht gespeichert und kann nach Abschluss des Bestellvorgangs nicht mehr abgerufen werden. Der Käufer kann die Daten aber unmittelbar vor dem Absenden der Bestellung ausdrucken und erhält nach der Bestellung eine E-Mail, in welcher die Bestellung des Kunden nochmals aufgeführt wird.
          </p>
          <p className="font-semibold">(5)</p>
          <p>
            Private Shirt wird auf Verlangen des Käufers Auskunft über die zu seiner Person gespeicherten Daten erteilen. Der Käufer hat jederzeit die Möglichkeit, seine bei Private Shirt gespeicherten Bestandsdaten für die Zukunft unter dem Link „Adresse ändern" in seinem Profil abzurufen und diese zu ändern.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 3 Preise</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die Preise im Internet Shop und die Preise in den einzelnen Geschäften (EKZ Quarree, EKZ Mercado, EKZ Europa Passage) können abweichen. Die Preise in den Geschäften werden individuell mit dem Kunden vor Ort vereinbart, so dass die Preise bei Online Bestellungen abweichen.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Für Besteller aus EU-Staaten sind die angegebenen Preise Endpreise. Sie enthalten die anfallenden gesetzlichen Steuern, insbesondere Mehrwertsteuern. Versandkosten werden gesondert in Rechnung gestellt und in der Rechnung sowie der Bestellung des Kunden gesondert ausgewiesen. Maßgeblich ist die Lieferadresse.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Für Besteller außerhalb der EU verstehen sich alle angegebenen Preise als Netto-Preise. Maßgeblich ist die Lieferadresse. Wenn gemäß den gesetzlichen Bestimmungen im Empfängerland Mehrwertsteuer anfällt, ist diese beim Empfang der Ware zusätzlich zu entrichten. Außerdem können Einfuhrzölle anfallen, die der Besteller beim Empfang der Ware zusätzlich entrichten muss.
          </p>
          <p className="font-semibold">(4)</p>
          <p>
            Führen wir auf Wunsch des Käufers Teillieferungen aus, hat dieser die hierdurch entstehenden Mehrkosten zu tragen.
          </p>
          <p className="font-semibold">(5)</p>
          <p>
            Die Lieferfrist verlängert sich, ohne dass wir darauf gesondert hinweisen, wenn und soweit der Käufer die Zahlungsart „Vorauskasse" gewählt hat, aber keine Zahlung leistet.
          </p>
          <p className="font-semibold">(6)</p>
          <p>
            Vorübergehende Lieferhindernisse aufgrund höherer Gewalt (z. B. Krieg, Handelsbeschränkungen, Streik, Pandemie Verkehrsstörungen) und anderer unvorsehbarer und von uns nicht zu vertretender Ereignisse berechtigen uns, die Lieferung erst nach Beseitigung dieses Hindernisses auszuführen. Wir werden den Käufer unverzüglich vom Vorliegen eines solchen Hindernisses in Kenntnis setzen. Besteht das Hindernis über mehr als zwei Wochen über unsere regelmäßigen Lieferfristen hinaus, sind sowohl wir als auch der Käufer berechtigt, unter angemessener Fristsetzung vom Vertrag zurückzutreten.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 4 Lieferung/ Versand</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die Lieferung erfolgt innerhalb Deutschlands sowie einiger europäischer Staaten, welche auf www.private-shirt.de eingesehen werden können.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Geliefert wird durch einen von Private Shirt zu wählenden Versanddienstleister. Vom Kunden ist eine Portopauschale zu tragen, welche vom Bestellwert und von dem Ort, an den geliefert werden soll, abhängig sein kann. Aktuelle Versandpreise können unter www.private-shirt.de eingesehen werden.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 5 Bezahlung</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die Bezahlung erfolgt gegen Vorkasse, PayPal, Sofortüberweisung, Kreditkarte oder auf Rechnung (Stammkunden) oder andere zu vereinbarende Bezahlmöglichkeiten.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Private Shirt ist berechtigt, sich bei der Abwicklung der Zahlung oder der Beitreibung der Dienste vertrauenswürdiger Dritter zu bedienen. Hierzu gehört auch die Möglichkeit der Abtretung der Forderung an Inkassobüros. Hierzu dürfen auch die zur Beitreibung erforderlichen persönlichen Daten an Dritte übertragen werden.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Ein Recht zur Aufrechnung steht dem Käufer nur zu, wenn sein Gegenanspruch rechtskräftig festgestellt, noch nicht rechtskräftig festgestellt, aber Entscheidungsreif ist oder die Forderung allgemein durch Private Shirt nicht bestritten wird.
          </p>
          <p className="font-semibold">(4)</p>
          <p>
            Private Shirt berechnet dem Kunden für Mahnungen nach Fälligkeit seiner Zahlungsverpflichtung, mit Ausnahme einer verzugsbegründenden Mahnung, eine Pauschale von 3 € pro Mahnung. Dem Kunden ist der Nachweis möglich, dass Private Shirt ein Schaden überhaupt nicht entstanden oder wesentlich geringer als die Pauschale ist. Private Shirt behält sich weitergehende Ansprüche infolge der Nichtzahlung ausdrücklich vor.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 6 Eigentumsvorbehalt</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die Ware bleibt bis zum Ausgleich der Private Shirt aufgrund des Kaufvertrags zustehenden Forderungen Eigentum von Private Shirt.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Ist der Käufer eine juristische Person des öffentlichen Rechts, ein öffentlich-rechtliches Sondervermögen oder ein Unternehmer gemäß § 14 BGB, bei dem der Vertrag zum Betrieb seines Handelsgewerbes gehört, gilt der Eigentumsvorbehalt für die Forderungen, die der Verkäufer aus seinen laufenden Geschäftsbeziehungen gegenüber dem Käufer hat. Bei Weiterveräußerung der Ware tritt der Käufer die aus dem Weiterverkauf der Ware entstehenden Forderungen gegen Dritte tritt der Käufer schon jetzt in Höhe der Forderung von Private Shirt zur Sicherheit an Private Shirt ab. Private Shirt nimmt die Abtretung an. Die abgetretene Forderung dient zur Sicherheit der Kaufpreisforderung, bei laufender Rechnung der Saldoforderung. Die in Abs. 3 genannten Pflichten des Käufers gelten auch in Ansehung der abgetretenen Forderungen.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Der Käufer ist verpflichtet, Private Shirt Zugriffe dritter Personen auf die unter Eigentumsvorbehalt gelieferten Waren unverzüglich anzuzeigen.
          </p>
          <p className="font-semibold">(4)</p>
          <p>
            Der Kunde ist verpflichtet, die Ware bis zum Eigentumsübergang pfleglich zu behandeln.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 7 Gewährleistung</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Angaben, Zeichnungen, Abbildungen, technische Daten, Gewichts-, Maß- und Leistungsbeschreibungen, die in Prospekten, Katalogen, Rundschreiben, Anzeigen oder Preislisten enthalten sind, haben rein informatorischen Charakter. Private Shirt übernimmt keine Gewähr für die Richtigkeit dieser Angaben. Hinsichtlich der Art und des Umfangs der Lieferung sind allein die in der Auftragsbestätigung enthaltenen Angaben ausschlaggebend.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Der Käufer kann zunächst als Nacherfüllung nach seiner Wahl die Beseitigung des Mangels oder die Lieferung einer mangelfreien Sache verlangen. Sofern die Nacherfüllung fehlschlägt kann der Käufer anstelle der Nacherfüllung die Minderung (Herabsetzung der Vergütung) verlangen oder nach seiner Wahl vom Vertrag zurücktreten. Der Rücktritt des Käufers ist ausgeschlossen, sofern lediglich ein geringfügiger Mangel vorliegt, der die gewöhnliche Verwendung nicht beeinträchtigt, und die Pflichtverletzung nur unerheblich war.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Gibt der Käufer in der Mängelanzeige die Art der von ihm gewünschten Nacherfüllung nicht ausdrücklich an, so können wir zwischen der Neulieferung und der Reparatur der Ware wählen.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 8 Haftungsbeschränkung</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Die Haftung von Private Shirt richtet sich im Übrigen nach den gesetzlichen Vorschriften, soweit in diesen Allgemeinen Geschäfts- und Lieferbedingungen nichts anderes bestimmt ist.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Auf Schadensersatz, gleich aus welchem Rechtsgrund, haftet Private Shirt bei Vorsatz und grober Fahrlässigkeit.
          </p>
          <p>
            Darüber hinaus haftet Private Shirt bei einfacher Fahrlässigkeit nur für:
          </p>
          <p>
            a) Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie
          </p>
          <p>
            b) Schäden aus der Verletzung einer wesentlichen Vertragspflicht (Verpflichtung, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Vertragspartner regelmäßig vertraut und vertrauen darf), in diesem Fall ist die Haftung jedoch auf den Ersatz des vorhersehbaren, typischerweise eintretenden Schadens begrenzt.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Die sich aus Absatz 2 ergebenden Haftungsbeschränkungen gelten nicht, soweit Private Shirt einen Mangel arglistig verschwiegen oder eine Garantie für die Beschaffenheit der Ware übernommen hat. Das gleiche gilt für Ansprüche des Kunden nach dem Produkthaftungsgesetz.
          </p>
          <p className="font-semibold">(4)</p>
          <p>
            Soweit die Haftung von Private Shirt in diesen Allgemeinen Geschäfts- und Lieferbedingungen ausgeschlossen oder eingeschränkt ist, gilt dies auch für die persönliche Schadensersatzhaftung der Angestellten, Arbeitnehmer, Mitarbeiter, Vertreter und Erfüllungsgehilfen von Private Shirt.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 9 Versendung</h2>
          <p>
            Eine Versendung der Ware an einen anderen Ort als den Leistungsort erfolgt auf Kosten des Käufers. Ist der Käufer eine juristische Person des öffentlichen Rechts, ein öffentlich-rechtliches Sondervermögen oder ein Unternehmer gemäß § 14 BGB, erfolgt die Versendung auf Risiko des Käufers.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 10 Belehrung und Information über das Widerrufsrecht für Verbraucher im Sinne von § 13 BGB</h2>
          <p className="font-semibold">Information über das Widerrufsrecht für Verbraucher</p>
          <p className="font-semibold">Widerrufsrecht.</p>
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.
          </p>
          <p>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
          </p>
          <p>
            Private Shirt GmbH<br />
            Ballindamm 40<br />
            20095 Hamburg<br />
            Deutschland<br />
            Tel.: +49 (0) 652 10 33<br />
            Fax: +49 (0) 652 10 61<br />
            E-Mail: info@private-shirt.de
          </p>
          <p>
            mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief, Telefax oder E-Mail) über ihren Entschluss, diesen Vertrag zu widerrufen, informieren.
          </p>
          <p>
            Zur Wahrung der Widerrufsfrist reicht es aus, daß Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </p>
          <p className="font-semibold">Folgen des Widerrufs.</p>
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über ihren Widerruf dieses Vertrages bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden wir Ihnen wegen dieser Rückzahlung Entgelte berechnen. Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.
          </p>
          <p>
            Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrages unterrichten, an uns Private Shirt GmbH, Ballindamm 40 / 20095 Hamburg, Deutschland zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden. Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.
          </p>
          <p>
            Sie müssen für einen etwaigen Wertverlust der Ware nur aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.
          </p>
          <p>
            Das Widerrufsrecht besteht nicht bei den folgenden Verträgen:
          </p>
          <p>
            Verträge zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 11 Urheberrechte an Druckdesigns, Haftungsfreistellung</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Übermittelt der Kunde ein eigenes Motiv oder nimmt sonstigen Einfluss auf das Produkt (Textpersonalisierung), versichert der Kunde gegenüber Private Shirt, dass Text und Motiv frei von Rechten Dritter sind. Etwaige Urheber-, Persönlichkeits- oder Namensrechtsverletzungen gehen in diesem Fall voll zu Lasten des Kunden. Auch versichert der Kunde, dass er durch die Individualisierung des Produkts keine sonstigen Rechte Dritter verletzt.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Der Kunde wird Private Shirt von allen Forderungen und Ansprüchen freistellen, die wegen der Verletzung von derartigen Rechten Dritter geltend gemacht werden, soweit der Kunde die Pflichtverletzung zu vertreten hat. Der Kunde erstattet Private Shirt alle entstehenden Verteidigungskosten und sonstige Schäden.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 12 Datenschutz</h2>
          <p>
            Private Shirt verarbeitet personenbezogene Daten des Kunden zweckgebunden und gemäß den gesetzlichen Bestimmungen. Die zum Zwecke der Bestellung von Waren angegebenen persönlichen Daten (wie zum Beispiel Name, E-Mail-Adresse, Anschrift, Zahlungsdaten) werden von Private Shirt zur Erfüllung und Abwicklung des Vertrags verwendet. Diese Daten werden von Private Shirt vertraulich behandelt und nicht an Dritte weitergegeben, die nicht am Bestell-, Auslieferungs- und Zahlungsvorgang beteiligt sind. Der Kunde hat das Recht, auf Antrag unentgeltlich Auskunft zu erhalten über die personenbezogenen Daten, die von Private Shirt über ihn gespeichert wurden. Zusätzlich hat er das Recht auf Berichtigung unrichtiger Daten, Sperrung und Löschung seiner personenbezogenen Daten, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">§ 13 Gerichtsstand</h2>
          <p className="font-semibold">(1)</p>
          <p>
            Für sämtliche gegenwärtigen und zukünftigen Ansprüche aus der Geschäftsverbindung mit Vollkaufleuten, einschließlich Wechsel- und Scheckforderungen ist ausschließlicher Gerichtsstand der Sitz des Verkäufers. Der gleiche Gerichtsstand gilt, wenn der Käufer keinen allgemeinen Gerichtsstand im Inland hat, nach Vertragsschluss seinen Wohnsitz oder gewöhnlichen Aufenthaltsort aus dem Inland verlegt oder sein Wohnsitz oder gewöhnlicher Aufenthaltsort zum Zeitpunkt der Klageerhebung nicht bekannt ist.
          </p>
          <p className="font-semibold">(2)</p>
          <p>
            Vertragssprache ist deutsch.
          </p>
          <p className="font-semibold">(3)</p>
          <p>
            Bei Lieferungen ins Ausland kann der Versender den Besteller auch an seinem Sitz verklagen.
          </p>

          <p className="mt-8 text-sm text-muted-foreground">
            Fassung 06/2020
          </p>
        </motion.div>
      </div>
    </Layout>
  );
};

export default AGB;

