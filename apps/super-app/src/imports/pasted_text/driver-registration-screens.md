DRIPPLEX DRIVER — PRODUCTION FIGMA ADDITION
Create exactly TWO new Driver Registration screens in the existing Production Figma Make project:

1. EmergencyContactScreen
2. AgreementAcceptanceScreen

These screens are NOT optional concepts. They are production UI screens that will later be implemented against existing Driver backend endpoints.

IMPORTANT:

- Do not redesign the existing Driver visual language.
- Reuse the existing Driver typography, colors, spacing, buttons, cards, radii, icons, navigation patterns and component conventions already present in this Make project.
- Do not introduce a new design system.
- Do not invent backend functionality.
- Do not add file upload functionality.
- Do not add authentication.
- Do not create Driver Splash/Login/OTP.
- These screens belong to the existing single Super-App identity model.
- The flow is:

Driver Registration
↓
Emergency Contact
↓
Agreement Acceptance
↓
Submit Registration
↓
SUBMITTED
↓
Waiting Approval

The two screens must feel like they were originally designed as part of the same Driver Registration experience.

==================================================
SCREEN 1 — EMERGENCY CONTACT
==================================================

Frame name:
EmergencyContactScreen

Purpose:
Collect the driver's emergency-contact information required before Driver Registration can be submitted.

Screen hierarchy:

TOP:

- Use the existing Driver Registration header/navigation pattern.
- Include a back navigation control consistent with existing Driver onboarding screens.
- Page title:
  "Emergency Contact"
- Supporting text:
  "Add someone we can contact in case of an emergency."

PROGRESS:
Show the registration progress clearly.

Use a compact progress indicator consistent with the existing Driver registration visual language.

Suggested label:
"Complete your registration"

Show this screen as the emergency-contact stage in the flow.

MAIN CONTENT:

Create a clean card/section titled:

"Emergency Contact"

Supporting text:

"Provide the details of a trusted person we can contact if we are unable to reach you."

FIELD 1:
Label:
"Full Name"

Placeholder:
"Enter emergency contact's full name"

Required field.

FIELD 2:
Label:
"Relationship"

Use a selectable field/dropdown following the existing Driver component style.

Suggested options:

- Spouse
- Parent
- Sibling
- Child
- Relative
- Friend
- Other

Required field.

FIELD 3:
Label:
"Phone Number"

Placeholder:
"Enter phone number"

Use the existing phone-number input styling.

Required field.

FIELD 4:
Label:
"Email Address"

Placeholder:
"Enter email address"

Optional field.

FIELD 5:
Label:
"Address"

Placeholder:
"Enter emergency contact address"

Optional unless the existing backend contract requires it.

Do not invent additional backend fields beyond what the existing Driver emergency-contact contract supports.

VALIDATION STATES:
Design the components so the following states are visually supported:

- Default
- Focused
- Filled
- Error
- Disabled

Example validation copy:

"Please enter the emergency contact's full name."

"Please enter a valid phone number."

"Please select your relationship."

Do not create fake backend validation behavior; these are visual states only.

SAFETY / PRIVACY NOTICE:

Below the fields, add a subtle information/security card.

Title:
"Emergency contact information"

Copy:
"This information is used only to contact your trusted person when necessary for your safety."

Use the existing informational-card treatment from the Driver design language.

PRIMARY CTA:

Button:
"Continue"

Full-width primary action.

Secondary action:
"Save and continue later"

Only include this if the existing Driver onboarding pattern supports a secondary action. Otherwise omit it.

BOTTOM:

Include a small progress indicator or step label such as:

"Step 1 of 2"

Do not imply that the entire Driver registration has only two steps. This represents the two final completion requirements being completed here.

RESPONSIVE DESIGN:
The screen must work cleanly on the Driver mobile viewport.

Keep:

- comfortable touch targets
- consistent vertical spacing
- no cramped fields
- no unnecessary decorative elements
- keyboard-safe content area
- CTA accessible without awkward scrolling

VISUAL STYLE:
Use ONLY the existing DrippleX Driver visual system already present in the Make project.

==================================================
SCREEN 2 — AGREEMENT ACCEPTANCE
==================================================

Frame name:
AgreementAcceptanceScreen

Purpose:
Allow the driver to review and explicitly accept the Driver Agreement/Terms before submitting registration.

TOP:
Use the same Driver Registration header and navigation pattern as EmergencyContactScreen.

Title:
"Driver Agreement"

Supporting text:
"Review and accept the Driver Agreement to complete your registration."

PROGRESS:

Use the same progress treatment as EmergencyContactScreen.

Indicate that Emergency Contact has been completed and Agreement is the current step.

Suggested:

✓ Emergency Contact 2. Driver Agreement

Do not introduce a different progress component from the existing Driver design language.

MAIN AGREEMENT CARD:

Create a large readable document/card section.

Heading:
"Driver Agreement"

Supporting description:
"Please review the terms and conditions that apply to your participation as a DrippleX driver."

Include a scrollable agreement-content area.

The agreement content should be realistic but concise UI placeholder/legal copy, clearly structured into sections:

1. Driver Responsibilities

- Maintain valid driving documents and vehicle requirements.
- Provide accurate registration information.
- Follow applicable traffic and safety laws.
- Treat passengers respectfully and professionally.

2. Safety

- Follow DrippleX safety procedures.
- Do not operate while impaired.
- Report serious incidents through the appropriate Driver support channels.

3. Vehicle Requirements

- Maintain the registered vehicle in safe operating condition.
- Keep required vehicle documentation valid.

4. Platform Conduct

- Do not misuse the platform.
- Do not provide false information.
- Do not engage in fraudulent activity.

5. Account & Registration

- Information submitted during registration must be accurate.
- DrippleX may review submitted information before activation.

6. Suspension / Termination

- Access may be restricted or suspended where applicable under the Driver Agreement and platform policies.

IMPORTANT:
This is UI placeholder/legal presentation content only.
Do not claim specific legal rights, commissions, penalties, fees, insurance terms, or jurisdiction-specific obligations unless they already exist in the project's approved source material.

Provide a clear link/text action:

"View full Driver Agreement"

This should visually appear as a text link or secondary action consistent with the existing design.

ACCEPTANCE:

Below the agreement content, create a required checkbox:

☐ "I have read and agree to the Driver Agreement and Terms of Service."

The checkbox must be clearly interactive-looking and large enough for mobile use.

Do NOT pre-check it.

Add an error state:

"Please accept the Driver Agreement to continue."

PRIMARY CTA:

Button:
"Continue"

Disabled when the agreement checkbox is unchecked.

Enabled when checked.

The visual design should clearly communicate why the button is disabled.

OPTIONAL SECONDARY ACTION:

"Back"

Use the existing navigation convention rather than creating a new button style.

SUBMISSION CONTEXT:

At the bottom, add a subtle information message:

"After completing this step, you can submit your Driver Registration for review."

Do not say that approval is automatic.

Do not display an approval percentage or fabricated verification score.

==================================================
FLOW CONNECTION
==================================================

The two screens must be visually and logically connected:

Driver Registration
→ EmergencyContactScreen
→ AgreementAcceptanceScreen
→ Submit Registration
→ SUBMITTED
→ Waiting Approval

EmergencyContactScreen:
Primary CTA "Continue"
→ AgreementAcceptanceScreen

AgreementAcceptanceScreen:
Primary CTA "Continue"
→ returns control to the Registration Completion flow where the existing Submit Registration action will occur.

IMPORTANT:
Do NOT create a new Submit Registration screen unless one already exists in the Production Figma.

Do NOT create a Waiting Approval screen unless one already exists.

Only create the two requested screens.

==================================================
COMPONENT CONSISTENCY
==================================================

Reuse existing components wherever possible:

- Driver header
- Back button
- Text fields
- Select/dropdown
- Primary button
- Secondary/text button
- Cards
- Checkbox
- Progress indicator
- Informational/security card
- Typography
- Icons

Do not create duplicate components if equivalent components already exist.

==================================================
DESIGN QUALITY
==================================================

The result must look like a finished DrippleX production screen, not a wireframe.

Requirements:

- Strong visual hierarchy
- Consistent spacing
- Clear labels
- Clear required/optional states
- Accessible contrast
- Mobile-first touch targets
- Consistent card radius
- Consistent typography
- Consistent iconography
- No placeholder lorem ipsum
- No random colors
- No invented branding
- No unrelated decorative illustrations

Do not modify existing Driver screens.

Do not modify the existing Design System.

Do not modify backend code.

Do not create API contracts.

Do not create authentication screens.

Do not add features beyond these two screens.

FINAL REQUIREMENT:

Create exactly these two frames:

EmergencyContactScreen
AgreementAcceptanceScreen

Place them logically alongside the existing Driver Registration screens.

After creation, leave the existing screens untouched and preserve all existing naming conventions and visual language.
