import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Check, Users, Percent, Truck, HeadphonesIcon, Upload, Plus, X } from "lucide-react";
import { useState } from "react";
import tshirtShelvesImage from "@/assets/ryoji-hayasaka-gkb-ayjimvda-unsplash@3x-1024x684.jpg";
import screenPrintingImage from "@/assets/naomi-august-ZQPekfTkImw-unsplash (1).jpg";

const benefits = [
  { icon: Users, title: "Ab 25 Stück", description: "Mengenrabatte schon ab kleinen Auflagen" },
  { icon: Percent, title: "Bis 50% sparen", description: "Günstigere Stückpreise bei größeren Mengen" },
  { icon: Truck, title: "Express möglich", description: "Schnelle Lieferung auf Anfrage" },
  { icon: HeadphonesIcon, title: "Persönliche Beratung", description: "Ihr Ansprechpartner für alle Fragen" },
];

interface MotiveData {
  datei: File | null;
  druckposition: string;
}

const Grossbestellung = () => {
  const [formData, setFormData] = useState({
    filiale: "",
    textilArt: "",
    textilQualitaet: "",
    druckverfahren: "",
    anrede: "",
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
    firma: "",
    stueckzahl: "",
    nachricht: "",
  });

  const [motive, setMotive] = useState<MotiveData[]>([
    { datei: null, druckposition: "" }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    const submissionData = {
      ...formData,
      motive: motive,
    };
    console.log("Form submitted:", submissionData);
    // TODO: Send to API
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const newMotive = [...motive];
      newMotive[index].datei = e.target.files[0];
      setMotive(newMotive);
    }
  };

  const handleMotivePositionChange = (index: number, value: string) => {
    const newMotive = [...motive];
    newMotive[index].druckposition = value;
    setMotive(newMotive);
  };

  const addMotive = () => {
    if (motive.length < 10) {
      setMotive([...motive, { datei: null, druckposition: "" }]);
    }
  };

  const removeMotive = (index: number) => {
    if (motive.length > 1) {
      const newMotive = motive.filter((_, i) => i !== index);
      setMotive(newMotive);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-12 pb-20 bg-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl lg:text-7xl font-black mb-6 leading-tight">
                <span className="text-primary block">du brauchst</span>
                <span className="text-primary block">masse?</span>
                <span className="text-secondary italic block">können wir.</span>
              </h1>
              <p className="text-lg text-primary/80 leading-relaxed">
                sie benötigen 200 t-shirts für ihr firmenevent? wir unterstützen sie bei ihrer auswahl. denn – kein shirt ist wie das andere.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="w-full aspect-square max-w-md mx-auto rounded-full overflow-hidden border-4 border-primary/20 shadow-2xl">
                <img
                  src={tshirtShelvesImage}
                  alt="Farbenfrohe T-Shirt Auswahl"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>

          {/* Content Section */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={screenPrintingImage}
                  alt="Professionelle Druckverfahren"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <p className="text-base text-foreground leading-relaxed">
                damit sie bei der auswahl der werbemittel in ihrem unternehmen den richtigen blick beweisen, beraten wir sie gerne individuell! bestellen sie aus unserem umfangreichen sortiment. von caps, mützen, schürzen, regenschirmen, t-shirts, poloshirts über jacken bis blusen und noch vielem mehr.
              </p>
              <p className="text-base text-foreground leading-relaxed">
                bei der auswahl der geeigneten bedruckung, bestickung oder anderer gestaltung stehen wir ihnen ebenfalls mit unserer über 10 jährigen erfahrung am markt zur seite.
              </p>
              <p className="text-base text-foreground leading-relaxed">
                die auswahl der richtigen werbemittel bestätigen uns viele zufriedene kunden. ab 30 teilen bieten wir ihnen attraktive konditionen bei top-qualität. vereinbaren sie einen beratungstermin oder kontaktieren sie uns gerne.
              </p>
              <Button
                size="lg"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-8 text-lg font-semibold"
                onClick={() => {
                  document.getElementById('grossbestellung-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                jetzt anfragen
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold text-center text-primary mb-12"
          >
            Ihre Vorteile bei Großbestellungen
          </motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 text-center hover-lift"
              >
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="grossbestellung-form" className="section-padding bg-accent/30">
        <div className="container-wide">

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-8 lg:p-12 max-w-4xl mx-auto rounded-3xl shadow-lg"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-2">jetzt anfragen und angebot erhalten</h2>
              <p className="text-muted-foreground">Füllen Sie das Formular aus und wir erstellen Ihnen ein individuelles Angebot</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Filiale */}
              <div className="glass-card p-6 rounded-2xl border border-border/50">
                <Label htmlFor="filiale" className="text-base font-semibold mb-3 block text-primary">
                  filiale *
                </Label>
                <Select value={formData.filiale} onValueChange={(value) => setFormData({ ...formData, filiale: value })}>
                  <SelectTrigger id="filiale" className="h-12">
                    <SelectValue placeholder="Filiale wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europa-passage">Europa Passage</SelectItem>
                    <SelectItem value="mercado-altona">Mercado Altona</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Textilien */}
              <div className="glass-card p-6 rounded-2xl border border-border/50 space-y-6">
                <h3 className="text-xl font-bold text-primary border-b border-border pb-3">textilien</h3>
                
                <div>
                  <Label htmlFor="textil-art" className="text-base font-semibold mb-2 block">
                    textil-art
                  </Label>
                  <Select value={formData.textilArt} onValueChange={(value) => setFormData({ ...formData, textilArt: value })}>
                    <SelectTrigger id="textil-art" className="h-12">
                      <SelectValue placeholder="Textil-Art wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tshirt-unisex">T-Shirts (Unisex)</SelectItem>
                      <SelectItem value="tshirt-damen">T-Shirts (Damen)</SelectItem>
                      <SelectItem value="tshirt-gemischt">T-Shirts (Damen + Herren gemischt)</SelectItem>
                      <SelectItem value="poloshirt">Poloshirts</SelectItem>
                      <SelectItem value="langarmshirt">Langarmshirts</SelectItem>
                      <SelectItem value="top-tank">Tops/Tanks</SelectItem>
                      <SelectItem value="sweatshirt">Sweatshirts</SelectItem>
                      <SelectItem value="kapuzenpullover">Kaputzensweater</SelectItem>
                      <SelectItem value="hemd-bluse">Hemden/Blusen</SelectItem>
                      <SelectItem value="jacke">Jacken</SelectItem>
                      <SelectItem value="schuerze">Schürzen</SelectItem>
                      <SelectItem value="basecap-muetze">Basecaps/Mützen</SelectItem>
                      <SelectItem value="tasse">Tassen</SelectItem>
                      <SelectItem value="mousepad">Mousepads</SelectItem>
                      <SelectItem value="sonstige">Sonstige ... (siehe Bemerkungen)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="textil-qualitaet" className="text-base font-semibold mb-2 block">
                    textil-Qualität *
                  </Label>
                  <Select value={formData.textilQualitaet} onValueChange={(value) => setFormData({ ...formData, textilQualitaet: value })}>
                    <SelectTrigger id="textil-qualitaet" className="h-12">
                      <SelectValue placeholder="Qualität wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leicht">Leichte Qualität (bspw. für Giveaways, Einmalshirts, etc.)</SelectItem>
                      <SelectItem value="mittel">Mittlere Qualität (sehr gute Waschbeständigkeit)</SelectItem>
                      <SelectItem value="schwer">Schwere Qualität (für anspruchsvolle Belastungen, Arbeitsbekleidung)</SelectItem>
                      <SelectItem value="bio">Bio-Baumwolle (zertifiziert mit Biosiegel)</SelectItem>
                      <SelectItem value="fair">Fair gehandelte Textilien (zertifizierte Sozialverträglichkeit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Druckdaten */}
              <div className="glass-card p-6 rounded-2xl border border-border/50 space-y-6">
                <h3 className="text-xl font-bold text-primary border-b border-border pb-3">Druckdaten</h3>
                
                <div>
                  <Label htmlFor="druckverfahren" className="text-base font-semibold mb-2 block text-primary">
                    druckverfahren (wenn bekannt)
                  </Label>
                  <Select value={formData.druckverfahren} onValueChange={(value) => setFormData({ ...formData, druckverfahren: value })}>
                    <SelectTrigger id="druckverfahren" className="h-12">
                      <SelectValue placeholder="Druckverfahren wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beratung">Beratung zu Druckverfahren erwünscht</SelectItem>
                      <SelectItem value="dtg">Digitaler Direktdruck (DTG)</SelectItem>
                      <SelectItem value="flex">Flexdruck</SelectItem>
                      <SelectItem value="flock">Flockdruck</SelectItem>
                      <SelectItem value="plastisol">Plastisoltransferdruck</SelectItem>
                      <SelectItem value="sieb">Siebdruck</SelectItem>
                      <SelectItem value="stick">Stick</SelectItem>
                      <SelectItem value="sublimation">Sublimationsdruck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Motive Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-primary">
                      Druckmotive ({motive.length}/10)
                    </Label>
                    {motive.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMotive}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Motiv hinzufügen
                      </Button>
                    )}
                  </div>

                  {motive.map((motiv, index) => (
                    <div key={index} className="glass-card p-4 rounded-xl border border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-primary">Motiv {index + 1}</h4>
                        {motive.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMotive(index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`datei-${index}`} className="text-sm font-semibold mb-2 block">
                          Druckmotiv hochladen
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          (.jpg, .png, .eps, .ai, .pdf möglich, Max. 10MB)
                        </p>
                        <div className="relative">
                          <input
                            type="file"
                            id={`datei-${index}`}
                            accept=".jpg,.jpeg,.png,.eps,.ai,.pdf"
                            onChange={(e) => handleFileChange(index, e)}
                            className="hidden"
                          />
                          <label
                            htmlFor={`datei-${index}`}
                            className="flex items-center gap-3 p-4 border-2 border-dashed border-input rounded-xl cursor-pointer hover:border-primary hover:bg-accent/50 transition-all bg-background/50"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Upload className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground block truncate">
                                {motiv.datei ? motiv.datei.name : "Datei auswählen"}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`druckposition-${index}`} className="text-sm font-semibold mb-2 block">
                          Druckposition
                        </Label>
                        <Select
                          value={motiv.druckposition}
                          onValueChange={(value) => handleMotivePositionChange(index, value)}
                        >
                          <SelectTrigger id={`druckposition-${index}`} className="h-11">
                            <SelectValue placeholder="Druckposition wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="brust-mittig">Brust - mittig</SelectItem>
                            <SelectItem value="brust-links">Brust - links (Herzseite)</SelectItem>
                            <SelectItem value="brust-rechts">Brust - rechts</SelectItem>
                            <SelectItem value="ruecken">Rücken</SelectItem>
                            <SelectItem value="nacken">Nacken</SelectItem>
                            <SelectItem value="aermel-links">Ärmel - links</SelectItem>
                            <SelectItem value="aermel-rechts">Ärmel - rechts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kontaktperson */}
              <div className="glass-card p-6 rounded-2xl border border-border/50 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-primary border-b border-border pb-3 mb-3">Kontaktperson</h3>
                  <p className="text-sm text-muted-foreground">
                    Um Ihnen schnellstmöglich ein kostenfreies, gewerbliches Angebot erstellen zu können, bitten wir Sie noch um folgende Angaben.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="anrede" className="text-base font-semibold mb-2 block">
                    anrede *
                  </Label>
                  <Select value={formData.anrede} onValueChange={(value) => setFormData({ ...formData, anrede: value })}>
                    <SelectTrigger id="anrede" className="h-12">
                      <SelectValue placeholder="Anrede wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="herr">Herr</SelectItem>
                      <SelectItem value="frau">Frau</SelectItem>
                      <SelectItem value="firma">Firma</SelectItem>
                      <SelectItem value="organisation">Organisation</SelectItem>
                      <SelectItem value="verein">Verein</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vorname" className="text-base font-semibold mb-2 block">
                      Vorname *
                    </Label>
                    <Input
                      id="vorname"
                      value={formData.vorname}
                      onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                      className="h-12"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="nachname" className="text-base font-semibold mb-2 block">
                      Nachname *
                    </Label>
                    <Input
                      id="nachname"
                      value={formData.nachname}
                      onChange={(e) => setFormData({ ...formData, nachname: e.target.value })}
                      className="h-12"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-base font-semibold mb-2 block">
                    E-Mail *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="telefon" className="text-base font-semibold mb-2 block">
                    Telefon
                  </Label>
                  <Input
                    id="telefon"
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="firma" className="text-base font-semibold mb-2 block">
                    Firma/Organisation
                  </Label>
                  <Input
                    id="firma"
                    value={formData.firma}
                    onChange={(e) => setFormData({ ...formData, firma: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="stueckzahl" className="text-base font-semibold mb-2 block">
                    Gewünschte Stückzahl *
                  </Label>
                  <Input
                    id="stueckzahl"
                    type="number"
                    value={formData.stueckzahl}
                    onChange={(e) => setFormData({ ...formData, stueckzahl: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="nachricht" className="text-base font-semibold mb-2 block">
                    Bemerkungen / Weitere Informationen
                  </Label>
                  <textarea
                    id="nachricht"
                    value={formData.nachricht}
                    onChange={(e) => setFormData({ ...formData, nachricht: e.target.value })}
                    className="w-full h-32 p-4 rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Zusätzliche Informationen zu Ihrer Anfrage..."
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full group h-14 text-lg font-semibold">
                abschicken
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Grossbestellung;
