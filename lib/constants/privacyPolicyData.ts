/**
 * MENZA PRIVACY POLICY & DATA PROTECTION POLICY
 * Operated By: QUBENEXUS TECHNOLOGIES PRIVATE LIMITED
 * Compliant with: Digital Personal Data Protection Act, 2023 (DPDP Act, India)
 * & Information Technology Act, 2000
 */

export interface PrivacySection {
  id: number;
  title: string;
  category: 'overview' | 'collection' | 'processing' | 'sharing' | 'security' | 'rights';
  icon: string;
  summary: string;
  content: string[];
}

export const MENZA_PRIVACY_METADATA = {
  appName: 'Menza',
  tagline: 'Smart • Simple • Serve',
  title: 'Privacy Policy & Data Protection Policy',
  effectiveDate: '31/08/2026',
  lastUpdated: '02/10/2026',
  website: 'www.menzaapp.co.in',
  operatedBy: 'QUBENEXUS TECHNOLOGIES PRIVATE LIMITED',
  address: 'Plot No 31, Sage Suncity Phase-2, Bagroda, Bhopal, Madhya Pradesh, PIN Code: 462026',
  supportEmail: 'support@qubenexus.co.in',
  privacyEmail: 'support@qubenexus.co.in',
  supportPhone: '+91 9713034109',
  jurisdiction: 'Bhopal, Madhya Pradesh, India',
  grievanceOfficer: {
    name: 'Grievance Officer, Qubenexus Technologies Pvt. Ltd.',
    designation: 'Data Protection & Grievance Redressal Officer',
    email: 'support@qubenexus.co.in',
    phone: '+91 9713034109',
    address: 'Plot No 31, Sage Suncity Phase-2, Bagroda, Bhopal, Madhya Pradesh, PIN Code: 462026',
  },
};

export const MENZA_PRIVACY_CATEGORIES = [
  { key: 'all', label: 'All Clauses' },
  { key: 'overview', label: 'Scope & Fiduciary' },
  { key: 'collection', label: 'Data Collection' },
  { key: 'processing', label: 'Usage & Grounds' },
  { key: 'sharing', label: 'Third Parties & Sub-processors' },
  { key: 'security', label: 'Security & Retention' },
  { key: 'rights', label: 'DPDP User Rights' },
] as const;

export const MENZA_PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 1,
    title: '1. Introduction & Operating Scope',
    category: 'overview',
    icon: 'Shield',
    summary: 'Data fiduciary and processor classifications under Indian law for Qubenexus Technologies Private Limited.',
    content: [
      'This Privacy Policy describes how QUBENEXUS TECHNOLOGIES PRIVATE LIMITED ("Qubenexus", "we", "us", or "our"), operating under the brand name "Menza" ("Menza Restaurant Suite", "Menza POS", "Menza Web"), collects, stores, uses, processes, shares, and protects information gathered from merchants, restaurants, cafe operators, their staff, and their dining patrons.',
      'We are committed to respecting and protecting the privacy of all Data Principals in accordance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 ("DPDP Act") of India.',
      'Depending on the context, Menza acts as a "Data Fiduciary" regarding merchant account, KYC, and billing records, and acts as a "Data Processor" when processing customer diner orders, e-bills, and table reservations on behalf of the registered Restaurant Merchant.',
    ],
  },
  {
    id: 2,
    title: '2. Information We Collect',
    category: 'collection',
    icon: 'Database',
    summary: 'Categories of personal, commercial, technical, and transactional data captured through the platform.',
    content: [
      'We collect the following categories of information to provide reliable cloud restaurant automation services:',
      '• Merchant & Owner Identity Data: Full legal name, business contact telephone number, mobile OTP verification records, email address, outlet trading name, and residential or business address.',
      '• Statutory & Licensing Documents: FSSAI food safety registration number, Goods and Services Tax Identification Number (GSTIN), local municipal health trade licenses, and business registration proofs.',
      '• Financial & Banking Details: Settlement bank account number, bank name, account holder name, IFSC code, UPI VPA (for settlement routing), and Cashfree payment gateway sub-merchant credentials.',
      '• Restaurant Staff & Access Records: Staff names, contact mobile numbers, assigned roles (Owner, Manager, Cashier, Kitchen Master, Captain, Waiter), encrypted PIN credentials, and shift audit logs.',
      '• Customer Dining & Transaction Data: Patron mobile numbers (collected upon voluntary consent for digital e-bill dispatch and WhatsApp KOT receipts), seated table identifier, ordered dishes, item modifications, bill amounts, tax breakdowns (CGST/SGST), and payment modes (Cash, UPI, Card, Due, Wallet).',
      '• Technical & Telemetry Information: IP address, operating system, web browser type, thermal printer connectivity status (ESC/POS Bluetooth/USB/Network), SignalR real-time WebSocket connection state, and application crash or performance diagnostics.',
    ],
  },
  {
    id: 3,
    title: '3. How We Use & Process Your Data',
    category: 'processing',
    icon: 'Cpu',
    summary: 'Legitimate business purposes including POS operations, tax compliance, payments, and notifications.',
    content: [
      'Menza processes collected data strictly for specific, lawful, and contractually defined purposes:',
      '• Cloud POS & Table Management: Facilitating table-side order entry, real-time KOT routing to kitchen display systems (KDS), and digital bill generation.',
      '• Statutory Tax Billing & Invoicing: Computing accurate GST tax splits (CGST & SGST), generating sequential tax invoices, and maintaining audit logs required under Indian tax statutes.',
      '• Payment Gateway Reconciliation: Processing digital QR table collections, tracking transaction statuses through Cashfree Payments, and reconciling commission wallet balances.',
      '• Merchant Wallet Management: Recording automated SaaS service debits, SMS credit top-ups, and payout settlements.',
      '• Communication & Service Alerts: Dispatching real-time order alerts, sound notifications, kitchen preparation updates, and transaction receipts via WhatsApp Cloud API or SMS.',
      '• Platform Security & Fraud Prevention: Detecting unauthorized logins, preventing multi-terminal collision, verifying merchant identity, and monitoring suspicious order manipulations.',
    ],
  },
  {
    id: 4,
    title: '4. Lawful Grounds for Processing (DPDP Act 2023)',
    category: 'processing',
    icon: 'Scale',
    summary: 'Statutory basis for data processing pursuant to Section 4 and Section 7 of the DPDP Act 2023.',
    content: [
      'Pursuant to the Digital Personal Data Protection Act, 2023, Menza processes personal data under the following legitimate grounds:',
      '1. Explicit Consent: Given by the restaurant owner during registration and account activation, and by dining patrons when opting for digital receipts or table reservations.',
      '2. Contractual Performance: Necessary for the execution and fulfillment of the Menza Merchant Agreement, POS software provisioning, and payment routing.',
      '3. Legal & Statutory Obligation: Complying with Indian financial reporting, Goods and Services Tax (GST) audit mandates, FSSAI traceability, and law enforcement directives.',
      '4. Legitimate Uses: Ensuring system security, preventing unauthorized access, disaster recovery, and resolving real-time operational tickets.',
    ],
  },
  {
    id: 5,
    title: '5. Data Sharing, Sub-processors & Third Parties',
    category: 'sharing',
    icon: 'Share2',
    summary: 'Trusted sub-processors, zero-sale commitment, and legal disclosure policies.',
    content: [
      'We do not sell, lease, rent, trade, or commercially exploit personal data to third-party data brokers, advertising networks, or telemarketers.',
      'We only share personal information with vetted sub-processors essential to delivering Menza services:',
      '• Payment Gateway Partners: Cashfree Payments India Private Limited, operating under RBI authorization for secure card, net banking, and UPI payment processing.',
      '• Messaging Providers: Meta WhatsApp Cloud API and authorized Indian telecom SMS gateways for sending digital KOTs, invoices, and OTP authentication messages.',
      '• Cloud Infrastructure Providers: Secure cloud server and database providers utilizing enterprise-grade firewalls and encrypted transit protocols.',
      '• Regulatory & Law Enforcement Agencies: When mandated by summons, court order, or official investigation issued by competent judicial authorities in Bhopal, Madhya Pradesh, or India.',
    ],
  },
  {
    id: 6,
    title: '6. Data Storage, Security & Encryption',
    category: 'security',
    icon: 'Lock',
    summary: 'Technical and organizational safeguards including TLS encryption, tokenization, and RBAC.',
    content: [
      'Qubenexus Technologies maintains comprehensive physical, organizational, and technological safeguards to prevent unauthorized access, alteration, disclosure, or loss of personal data:',
      '• In-Transit Encryption: All data transmitted between merchant web browsers, mobile terminals, and Menza backend servers is encrypted using Transport Layer Security (TLS 1.3 / HTTPS) and Secure WebSockets (WSS).',
      '• At-Rest Protection: Database volumes, automated daily backups, and sensitive configuration tokens are encrypted using AES-256 standards.',
      '• Role-Based Access Controls (RBAC): Strict operational barriers ensure kitchen stations, captains, and cashiers only have access to operational data required for their specific shift duties.',
      '• Secure Authentication: Industry-standard JSON Web Token (JWT) architecture with short-lived tokens and secure session management.',
      '• Vulnerability Assessments: Regular automated security scans, SQL injection prevention, and API rate-limiting against denial-of-service attempts.',
    ],
  },
  {
    id: 7,
    title: '7. Data Retention & Archival Policies',
    category: 'security',
    icon: 'Clock',
    summary: 'Retention timelines in compliance with Indian commercial and taxation laws.',
    content: [
      '• Merchant Account Records: Maintained for the active duration of the commercial relationship and up to 7 (seven) financial years post-termination to comply with Section 128 of the Companies Act, 2013 and GST audit statutes.',
      '• Customer Order History: Retained by the merchant on the cloud ledger for operational audit and refund reconciliation purposes for a minimum statutory period.',
      '• Temporary Telemetry & Session Logs: Server access logs, SignalR connection traces, and debug diagnostics are automatically rotated and purged within 90 days.',
      '• Account Deletion Requests: Upon validated merchant account closure, non-statutory personal identifiers are permanently scrubbed or anonymized.',
    ],
  },
  {
    id: 8,
    title: '8. Data Principal Rights under DPDP Act 2023',
    category: 'rights',
    icon: 'UserCheck',
    summary: 'Your statutory rights to access, correct, erase, nominate, and file grievances.',
    content: [
      'Under the Digital Personal Data Protection Act, 2023, every Data Principal (merchant owner, staff, or customer) possesses enforceable rights:',
      '• Right to Access: You may request a summary of the personal data we hold about you and the processing activities undertaken.',
      '• Right to Correction & Completion: You may update or rectify inaccurate, outdated, or incomplete profile, tax, or banking information through the Menza Settings portal.',
      '• Right to Erasure: You may request the deletion of your personal data where continued retention is no longer necessary for legal, accounting, or contractual requirements.',
      '• Right to Grievance Redressal: You have the right to register complaints regarding the handling of your personal data with our designated Grievance Officer.',
      '• Right to Nominate: You may designate an individual who shall, in the event of death or incapacity, exercise your rights as a Data Principal.',
    ],
  },
  {
    id: 9,
    title: '9. Cookies & Browser Local Storage',
    category: 'security',
    icon: 'Cookie',
    summary: 'Use of essential web storage for authentication sessions, active outlet context, and theme state.',
    content: [
      'The Menza web application utilizes browser local storage (localStorage and sessionStorage) exclusively for functional and security purposes:',
      '• Authentication State: Encrypted auth tokens, refresh tokens, and session expiry timers.',
      '• Active Restaurant Context: Selected outlet ID and outlet metadata across multi-restaurant operations.',
      '• UI Preferences: Selected color theme (Dark Mode / Light Mode) and sound notification volume preferences.',
      '• Menza does not use third-party tracking cookies or cross-site tracking pixels.',
    ],
  },
  {
    id: 10,
    title: '10. Grievance Officer & Contact Details',
    category: 'rights',
    icon: 'Headphones',
    summary: 'Official point of contact for privacy queries, compliance reports, and legal inquiries.',
    content: [
      'In accordance with the DPDP Act 2023 and the Information Technology Act 2000, any complaints, concerns, or requests regarding this Privacy Policy should be addressed to our designated Grievance Officer:',
      '• Attention: Grievance Officer',
      '• Company: QUBENEXUS TECHNOLOGIES PRIVATE LIMITED',
      '• Brand: Menza Restaurant Suite',
      '• Registered Address: Plot No 31, Sage Suncity Phase-2, Bagroda, Bhopal, Madhya Pradesh, PIN Code: 462026',
      '• Email: support@qubenexus.co.in',
      '• Phone: +91 9713034109',
      '• Working Hours: Monday to Saturday, 10:00 AM to 6:00 PM IST',
      'We shall acknowledge your grievance within 48 hours and make best endeavors to resolve it within 30 days of receipt.',
    ],
  },
];
