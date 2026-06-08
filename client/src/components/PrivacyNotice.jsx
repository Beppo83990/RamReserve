// Data Privacy Act of 2012 (Republic Act No. 10173) notice shown on the
// authentication screens so users are informed of how their personal data is
// collected and processed each time they register or log in.
export default function PrivacyNotice() {
  return (
    <section className="privacy-notice" aria-label="Data Privacy Notice">
      <details className="privacy-notice__more">
        <summary className="privacy-notice__title">🔒 Data Privacy Notice</summary>
        <p className="privacy-notice__lead">
          In compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>,
          RamReserve collects and processes your personal information solely to create and
          manage your account and your facility reservations.
        </p>
        <ul>
          <li>
            <strong>What we collect:</strong> your name, email address, and reservation
            activity.
          </li>
          <li>
            <strong>Why:</strong> to authenticate you, manage bookings, and prevent
            scheduling conflicts.
          </li>
          <li>
            <strong>How it's protected:</strong> data is stored securely and access is
            restricted to authorized personnel.
          </li>
          <li>
            <strong>Retention:</strong> kept only while your account is active and as
            required by applicable law.
          </li>
          <li>
            <strong>Sharing:</strong> never disclosed to third parties without your consent,
            except when required by law.
          </li>
          <li>
            <strong>Your rights:</strong> you may access, correct, or request deletion of your
            personal data at any time.
          </li>
        </ul>
      </details>
    </section>
  );
}
