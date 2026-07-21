## OCR and text conversion process

1. File is chosen and uploaded on web 
2. File is uploaded to /temp on firebase storage 
3. URL pointing to file location is fetched and sent to API
4. API processes the image and converts content into LaTeX/Markdown
  - Detected illustrations are converted into cropped assets and temporarily hosted in Mathpix CDN server 
  - Cropped assets are routed to /illustrations on firebase storage
  - Temporary CDN URLs of the cropped assets in the LaTeX are replaced with the corresponding permanent firebase storage URL
5. LaTeX/Markdown is displayed to user for checking; text is naturally rendered
6. If form is submitted, the problem and solution files are reuploaded to problems/ in the firebase storage, organised and grouped together, together with any illustrations extracted
7. Database entry in created in firestore, with the relevant details and URLs

## Database structure

Each problem entry in the database consists of the following fields

problemSource: (string)

source: (string)

competition: (string)

selectionTest: ()

textbook: ()

sourceType: (string)

createdAt: (timestamp)

difficulty: (int)

fileCount (map)

problem: (int)

solution: (int)

ocrConfidence (map)
- problem: (int)
- solution: (int)

problemLatex: (string)

problemStatementUrls (array)
- (string)
- (string)

problemText: (string)

solutionLatex: (string)

solutionText: (string)

solutionUrls (array)
- (string)
- (string)

status: (string)

subtags: (array)
- (string)
- (string)

title: (string)

topic: (string)

updatedAt: (timestamp)

userDisplayName: (string)

userEmail: (string)

userId: (string)

year: (int)