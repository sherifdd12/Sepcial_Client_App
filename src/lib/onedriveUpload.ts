import axios from 'axios';

export async function uploadToOneDrive({ accessToken, file, folderPath }) {
  // Sanitize folderPath: allow alphanumeric, Arabic characters, spaces, dash, underscore, and slashes
  // This is a more robust regex that removes characters forbidden by OneDrive.
  const safeFolderPath = String(folderPath || '')
    .replace(/[<>:"|?*]/g, '') // Remove invalid characters for OneDrive paths
    .replace(/\/+/g, '/') // Collapse multiple slashes
    .replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes as we'll add them manually

  // Sanitize file name: replace invalid characters with an underscore
  let safeFileName = String(file.name)
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters with underscore
    .slice(0, 128); // Limit length
  if (!safeFileName || safeFileName.startsWith('.')) {
    safeFileName = `file_${safeFileName}`;
  }

  // Construct the absolute path required by the Graph API
  const absolutePath = `/${safeFolderPath}/${safeFileName}`;
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${absolutePath}:/content`;

  const response = await axios.put(uploadUrl, file, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.type,
    },
  });

  // Return the full file metadata from the response, and add our constructed absolute path
  return { ...response.data, filePath: absolutePath };
}