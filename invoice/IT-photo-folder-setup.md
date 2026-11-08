# IBA System: read-only access to the OneDrive Photo folder

The IBA System (inventory photo picker) needs to LIST the file names in
`https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC Files/Photo`.
It reads names only. It never writes, deletes or downloads anything else.

## What IT needs to do (Microsoft Entra ID / Azure portal, about 5 minutes)

1. Go to **Entra ID > App registrations > New registration**.
   - Name: `IBA System Photo Picker`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**, value:
     `<the address the IBA System opens at>/msal-redirect.html`
     (for example `https://port.iba.com.qa/invoice/msal-redirect.html`)
2. Go to **API permissions > Add a permission > Microsoft Graph > Delegated** and add **Files.Read.All**.
   Then click **Grant admin consent** so users don't get a consent prompt.
3. Send back two values from the app's **Overview** page:
   - **Application (client) ID**
   - **Directory (tenant) ID**

Each user signs in with their company Microsoft account once, in the photo picker.
They only see photos they already have access to. The Photo folder must stay
shared with the staff who add photos.
