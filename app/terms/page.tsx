import Link from "next/link";

const DEFAULT_SUPPORT_EMAIL = "support@suppr-club.com";

export default function TermsPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="text-violet-600 dark:text-violet-400 underline underline-offset-2 hover:text-violet-700 dark:hover:text-violet-300"
          >
            ← Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Terms of service</h1>
        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <p>
            <strong>Last updated:</strong> April 2026. &ldquo;Suppr&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; and
            &ldquo;our&rdquo; refer to the team operating the Suppr recipe and nutrition service at{" "}
            <Link href="/" className="text-violet-600 dark:text-violet-400 underline">suppr-club.com</Link>{" "}
            and the Suppr mobile app. By creating an account, signing in, or continuing to use Suppr you agree to these
            terms. If you do not agree, do not use the service.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">The service</h2>
          <p>
            Suppr is a recipe, meal-planning, and nutrition-tracking service. It lets you save recipes, build meal plans,
            log what you eat, and see estimated nutrition totals. Optional AI-assisted features (for example photo or voice meal
            logging) rely on third-party models; see the{" "}
            <Link
              href="/privacy"
              className="text-violet-600 dark:text-violet-400 underline underline-offset-2 font-medium hover:text-violet-700 dark:hover:text-violet-300"
            >
              Privacy policy
            </Link>{" "}
            for how that processing works. Suppr is provided &ldquo;as is&rdquo; for personal use.
          </p>
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 pt-0 mt-0">Not medical or dietetic advice</h2>
            <p className="text-amber-900 dark:text-amber-100">
              Suppr is a consumer tracking tool. It is <strong>not</strong> a medical device, nor is it a substitute for advice from a
              qualified doctor, registered dietitian, or other healthcare professional. Do not use Suppr to diagnose, treat, cure, or
              prevent any disease or condition. Always consult a qualified professional before making decisions that could affect your
              health &mdash; particularly if you are pregnant, managing a medical condition (including diabetes, eating disorders, kidney
              disease, or allergies), taking medication, or making changes for a child.
            </p>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Nutrition estimates</h2>
          <p>
            Every nutrition value shown in Suppr &mdash; calories, macros, micronutrients, portion weights &mdash; is an{" "}
            <strong>estimate</strong> generated from public and licensed food databases (USDA FoodData Central, Open Food Facts,
            Edamam, FatSecret), barcode lookups, recipe parsing, and AI-assisted photo or voice recognition. Estimates can be wrong
            for many reasons, including database gaps, brand variation, cooking losses, portion-size ambiguity, and AI misidentification.
            Accuracy is <strong>not guaranteed</strong>. You are responsible for reviewing and correcting any value before relying on
            it for health, training, or clinical purposes.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Eligibility</h2>
          <p>
            You must be at least 13 years old to use Suppr (or 16 in jurisdictions where GDPR applies without
            parental consent). By creating an account, you confirm you meet this age requirement.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Account registration and security</h2>
          <p>
            To use most of Suppr you need an account. You agree to provide accurate information, to keep your sign-in
            credentials confidential, and to tell us promptly at{" "}
            <a href={`mailto:legal@suppr.app`} className="text-violet-600 dark:text-violet-400 underline">legal@suppr.app</a>{" "}
            if you believe your account has been compromised. You are responsible for activity that happens under your account. We
            may suspend accounts showing signs of unauthorised use, fraud, or abuse.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Your content &mdash; licence you grant us</h2>
          <p>
            You keep the rights to everything you upload, import, or create in Suppr (&ldquo;Your Content&rdquo;).
            You are solely responsible for Your Content and for making sure you have the rights to share it.
          </p>
          <p>
            So we can actually show, store, back up, and process Your Content on the service, you grant Suppr a
            non-exclusive, worldwide, royalty-free licence to host, store, copy, display, transmit, and create
            derivative versions of Your Content (for example resized images, parsed ingredient lists, derived macro
            totals, translations, AI-derived matches) and to sub-licence those acts to our sub-processors listed in
            the{" "}
            <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy policy</Link>{" "}
            (Supabase, Vercel, OpenAI, Stripe, Apple, and others) strictly for the purpose of operating Suppr for you.
            This licence lasts for as long as Your Content is stored in Suppr and ends when you delete it or close
            your account. If you publish a recipe to the community feed, the licence extends for as long as that
            recipe remains public to allow us to keep showing it to other users who have saved it, subject to your
            right to unpublish at any time.
          </p>
          <p>
            We do not claim ownership of Your Content, we do not use it to train AI models, and we do not sell it.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>upload content you do not have the right to share, or that infringes another person&rsquo;s copyright, trademark, privacy, or publicity rights;</li>
            <li>scrape, reverse-engineer, overload, or otherwise misuse the Suppr service or its APIs;</li>
            <li>use Suppr to harass, defame, threaten, or impersonate another person;</li>
            <li>circumvent access controls, rate limits, or paywalls on Suppr or on any third-party service Suppr fetches on your behalf;</li>
            <li>use automated tools to import content in a way that breaches the source site&rsquo;s terms of service.</li>
          </ul>
          <p>
            When Suppr fetches a URL on your behalf (for example a recipe import), we do so using an identified
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded mx-1">SupprBot</code>
            user agent that links to a public bot contact page, we do not circumvent access controls, and we respect
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded mx-1">robots.txt</code>
            where applicable. You remain responsible for choosing URLs that you are entitled to import.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Copyright &mdash; DMCA and takedown</h2>
          <p>
            We respect intellectual-property rights and follow the notice-and-takedown procedure in 17 U.S.C. &sect; 512
            of the Digital Millennium Copyright Act (DMCA) and, for UK and EU users, the equivalent notice-and-action
            process under the UK Online Safety Act and the EU Digital Services Act. If you believe content on Suppr
            infringes your copyright, please see our{" "}
            <Link href="/dmca" className="text-violet-600 dark:text-violet-400 underline">DMCA / takedown page</Link>{" "}
            for how to submit a notice. We may terminate the accounts of users who repeatedly infringe.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Subscriptions</h2>
          <p>
            Paid features may be billed through Stripe (web) or Apple&rsquo;s App Store / Google Play (mobile). On
            mobile, payment is processed by the respective app store. Prices are shown before purchase in your
            local currency. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
            current billing period. You can manage or cancel your subscription:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>iOS:</strong> Settings &gt; Apple ID &gt; Subscriptions</li>
            <li><strong>Android:</strong> Google Play &gt; Payments &amp; subscriptions</li>
            <li><strong>Web:</strong> Via the Stripe customer portal linked in your account settings</li>
          </ul>
          <p>
            You can restore previous purchases at any time from the app&rsquo;s paywall or settings screen. Refund
            policies follow the respective platform&rsquo;s guidelines (Apple, Google, or Stripe).
          </p>
          <section id="refunds" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Refunds (7-day policy)</h2>
            <p>
              If you&rsquo;re unhappy with a Suppr subscription purchased on the web within the first 7 days of
              your billing period, email{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="text-violet-600 dark:text-violet-400 underline underline-offset-2 font-medium hover:text-violet-700 dark:hover:text-violet-300"
              >{supportEmail}</a>{" "}and we&rsquo;ll process a refund manually via Stripe. Mobile purchases made through
              the Apple App Store or Google Play are governed by the respective store&rsquo;s refund policy &mdash;
              please use Apple&rsquo;s &ldquo;Report a Problem&rdquo; or Google Play&rsquo;s refund flow for those.
            </p>
          </section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Termination</h2>
          <p>
            You can stop using Suppr and delete your account at any time from Settings. We can suspend or terminate
            accounts that breach these terms, abuse the service, or trigger repeated copyright notices.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Intellectual property</h2>
          <p>
            The Suppr service, including the software, database structure, user interface, brand name, logo, and supporting content
            we create, is owned by Suppr and protected by copyright, trademark, and other laws. Third-party food-database content
            surfaced through Suppr (for example USDA FoodData Central, Open Food Facts, Edamam, FatSecret) remains the property of
            the respective rights-holders and is shown under their published licences &mdash; see{" "}
            <Link href="/licences" className="text-violet-600 dark:text-violet-400 underline">licences</Link>{" "}
            for details. You may not copy, distribute, or create derivative works from the Suppr codebase or branded assets except as
            expressly permitted.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Limitation of liability</h2>
          <p>
            <strong>[PLACEHOLDER &mdash; pending formal legal review.]</strong> To the maximum extent permitted by law, Suppr and its
            contributors are not liable for indirect, incidental, special, or consequential damages arising from use of the app,
            including (without limitation) losses attributable to reliance on nutrition estimates. Our total aggregate liability to
            you for any claim arising out of or relating to the service is limited to the greater of (a) the amount you paid Suppr
            in the twelve months before the event giving rise to the claim or (b) GBP 100. Nothing in these terms excludes liability
            that cannot be excluded by law (for example liability for death or personal injury caused by negligence, for fraud, or
            for a consumer&rsquo;s statutory rights that cannot be waived).
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Governing law and jurisdiction</h2>
          <p>
            <strong>[PLACEHOLDER &mdash; pending the incorporation decision tracked in{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md</code>.]</strong>{" "}
            Governing law and exclusive jurisdiction will be set once the operating entity is incorporated. Until then, consumers
            in the UK and the EU retain the benefit of mandatory local consumer-protection law and may bring proceedings in the
            courts of their place of residence.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">EU consumer withdrawal rights</h2>
          <p>
            If you are a consumer resident in the European Union or the United Kingdom, you have a statutory right to cancel a
            purchase of digital content or digital services within <strong>14 days</strong> of the contract being concluded,
            without giving a reason. Because Suppr is a digital service whose performance starts immediately on purchase,{" "}
            <strong>you are asked to expressly consent to performance beginning before the 14-day period ends and to acknowledge
            that, by doing so, you lose the right to withdraw once performance has begun in full</strong>. If you purchased a
            subscription and wish to exercise a withdrawal right before performance has begun, email{" "}
            <a href={`mailto:legal@suppr.app`} className="text-violet-600 dark:text-violet-400 underline">legal@suppr.app</a>{" "}
            within 14 days of purchase. This right is separate from, and additional to, the voluntary 7-day refund policy above,
            and it does not apply to in-app purchases made through the Apple App Store or Google Play (which are governed by the
            respective store&rsquo;s policy).
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Changes to these terms</h2>
          <p>
            We may update these terms from time to time. If a change is material we will tell you before it takes
            effect (for example by email or an in-app notice). Continued use of Suppr after the effective date means
            you accept the updated terms.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Contact</h2>
          <p>
            Legal notices, DMCA / IP complaints, and questions about these terms:{" "}
            <a href={`mailto:legal@suppr.app`} className="text-violet-600 dark:text-violet-400 underline">legal@suppr.app</a>.
            General support:{" "}
            <a href={`mailto:${supportEmail}`} className="text-violet-600 dark:text-violet-400 underline">{supportEmail}</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
