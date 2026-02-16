# TODO - Employee Document Upload Access

## Task: Give employees access to upload their documents

### Analysis Complete:
- Backend already handles all 6 document types (adharCard, panCard, salarySlip, relievingLetter, experienceLetter, offerLetter)
- UserProfile.js already has:
  - Upload modal with all document types
  - View document modal
  - handleDocumentUpload function
  - Documents tab showing 3/6 documents

### What needs to be done:
- [ ] Add remaining 3 document types to Documents tab in UserProfile.js:
  - Relieving Letter
  - Experience Letter  
  - Offer Letter

### Files to edit:
- client/src/pages/UserProfile.js - Add missing document cards in the documents grid
