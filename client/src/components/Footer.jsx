export default function Footer() {
  return (
    <footer className="footer">
      <span className="footer-brand">RamReserve</span>
      <span className="footer-meta">
        Room &amp; equipment reservations · © {new Date().getFullYear()} APC
      </span>
    </footer>
  );
}
