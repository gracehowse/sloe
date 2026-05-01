import Link from "next/link";
import type { Metadata } from "next";
import { DmcaTakedownForm } from "./_form/DmcaTakedownForm";

// NOTE FOR OPERATOR: To make the § 512(c) safe harbour effective, the Suppr
// designated agent still needs to be registered with the US Copyright Office
// at https://www.copyright.gov/dmca-directory/ (fee: $6, renewable every
// 3 years). The email address and postal address shown below must match
// what is filed on that registration. Update this file when the filing
// completes. See the IP-counsel memo dated 2026-04-19.

export const metadata: Metadata = {
  title: "DMCA / Copyright takedown — Suppr",
  description: "How to submit a copyright takedown notice, counter-notice, and Suppr's repeat-infringer policy.",
};

const DMCA_EMAIL = "dmca@suppr-club.com";

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
            &larr; Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">
          Copyright &amp; DMCA takedown
        </h1>

        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <p>
            Suppr respects copyright. If you believe that content on Suppr infringes your copyright, you can ask us
            to take it down using the procedure below. This page describes how to submit a notice under the Digital
            Millennium Copyright Act (&ldquo;DMCA&rdquo;, 17 U.S.C. &sect; 512) and the equivalent notice-and-action
            processes in the UK and EU.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">
            Quick submission form
          </h2>
          <p>
            For most takedown requests, the form below is the fastest path. We
            record the submission directly to our reviewer queue and respond to
            the email you provide within 7 business days. The email channel
            below is still available if you prefer.
          </p>
          <DmcaTakedownForm />

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Designated agent</h2>
          <p>
            Send DMCA takedown notices, counter-notices, and any copyright-related correspondence to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${DMCA_EMAIL}`} className="text-violet-600 dark:text-violet-400 underline">
                {DMCA_EMAIL}
              </a>{" "}
              (fastest route)
            </li>
            <li>
              <strong>Subject line:</strong> <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">DMCA takedown notice</code>{" "}
              or <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">DMCA counter-notice</code>
            </li>
            <li>
              <strong>Postal address:</strong> available on request by emailing the address above.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">
            Submitting a takedown notice
          </h2>
          <p>
            Under 17 U.S.C. &sect; 512(c)(3) a valid takedown notice must be a written communication that includes
            substantially the following:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>your physical or electronic signature (typed name is acceptable for email);</li>
            <li>identification of the copyrighted work you claim has been infringed (or, for multiple works, a representative list);</li>
            <li>
              identification of the material on Suppr that you claim is infringing &mdash; please include the
              full URL (for example{" "}
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://suppr-club.com/recipe/...</code>
              ) or any other information that lets us locate it;
            </li>
            <li>your contact information: full legal name, address, telephone number, and email;</li>
            <li>
              a statement that you have a <em>good-faith belief</em> that the use complained of is not authorised by
              the copyright owner, its agent, or the law;
            </li>
            <li>
              a statement that the information in the notice is accurate, and <em>under penalty of perjury</em>, that
              you are the copyright owner or authorised to act on the owner&rsquo;s behalf.
            </li>
          </ol>
          <p>
            We will act on valid notices without undue delay and will tell you and the user whose content is affected
            what we did.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Counter-notice</h2>
          <p>
            If content you posted was removed and you believe the removal was a mistake or misidentification, you can
            send a counter-notice under 17 U.S.C. &sect; 512(g)(3) containing:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>your signature (typed name is fine on email);</li>
            <li>identification of the material that was removed and the location at which it appeared before removal;</li>
            <li>
              a statement <em>under penalty of perjury</em> that you have a good-faith belief the removal was a
              mistake or misidentification;
            </li>
            <li>your name, address, and telephone number;</li>
            <li>
              a statement that you consent to the jurisdiction of the US federal district court for the district in
              which your address is located (or, if outside the US, any judicial district in which Suppr may be found)
              and that you will accept service of process from the person who submitted the original notice.
            </li>
          </ol>
          <p>
            When we receive a valid counter-notice we will forward it to the person who sent the original notice and
            may restore the content after 10&ndash;14 business days unless they notify us that they have filed a court
            action.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">
            Repeat-infringer policy
          </h2>
          <p>
            In accordance with 17 U.S.C. &sect; 512(i), Suppr will terminate the accounts of users who are the
            subject of repeated copyright takedown notices in appropriate circumstances. A &ldquo;repeat
            infringer&rdquo; generally means a user whose account has been the subject of three or more valid
            takedown notices.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">
            False or abusive notices
          </h2>
          <p>
            Under 17 U.S.C. &sect; 512(f), anyone who knowingly materially misrepresents that material is infringing,
            or that material was removed by mistake, may be liable for damages. Please only send a notice if you are
            the copyright owner (or authorised to act for one).
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">
            UK and EU users
          </h2>
          <p>
            Users in the UK and EU can use the same email above. We follow the notice-and-action processes set out in
            the UK Online Safety Act 2023 and the EU Digital Services Act (Regulation (EU) 2022/2065). You do not need
            to swear under US perjury law &mdash; a truthful, signed statement describing the work and the
            infringement is sufficient.
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-4">
            See also:{" "}
            <Link href="/terms" className="text-violet-600 dark:text-violet-400 underline">Terms of service</Link>
            {" "}&middot;{" "}
            <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
