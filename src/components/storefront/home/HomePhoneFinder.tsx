import Link from "next/link";

const INTENTIONS = [
  { label: "Under ₹15,000", href: "/new-mobiles?max=15000&sort=price_asc", hint: "Everyday value" },
  { label: "₹15K–₹25K", href: "/new-mobiles?min=15000&max=25000&sort=price_asc", hint: "Smart picks" },
  { label: "₹25K–₹40K", href: "/new-mobiles?min=25000&max=40000&sort=price_asc", hint: "Balanced" },
  { label: "₹40K–₹70K", href: "/new-mobiles?min=40000&max=70000&sort=price_asc", hint: "Premium mid" },
  { label: "Flagship", href: "/new-mobiles?min=70000&sort=price_desc", hint: "No compromise" },
  { label: "Best camera", href: "/new-mobiles?brand=google", hint: "Picture-first" },
  { label: "Gaming", href: "/new-mobiles?brand=iqoo", hint: "High refresh" },
  { label: "5G ready", href: "/new-mobiles", hint: "Future proof" },
];

export function HomePhoneFinder() {
  return (
    <section id="finder" className="ms-section ms-finder" aria-labelledby="finder-heading">
      <div className="ms-shell">
        <div className="ms-finder-panel">
          <div className="ms-jaali ms-jaali--finder" aria-hidden />
          <div className="ms-finder-copy">
            <p className="ms-eyebrow">Phone finder</p>
            <h2 id="finder-heading" className="ms-display ms-display--md">
              Find your next phone.
            </h2>
            <p className="ms-lede ms-lede--narrow">
              Start with how you shop — budget bands and buying intent — then browse phones that match.
            </p>
          </div>

          <ul className="ms-intent-grid">
            {INTENTIONS.map((item, index) => (
              <li key={item.label}>
                <Link href={item.href} className="ms-intent">
                  <span className="ms-intent-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ms-intent-label">{item.label}</span>
                  <span className="ms-intent-hint">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
