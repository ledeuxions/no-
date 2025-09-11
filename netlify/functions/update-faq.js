
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { GITHUB_TOKEN } = process.env;
  if (!GITHUB_TOKEN) {
    return { statusCode: 500, body: 'GitHub token not configured' };
  }

  const newFaqContent = event.body;
  const repoOwner = 'ledeuxions';
  const repoName = 'no-';
  const filePath = 'faq.json';
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  try {
    // 1. Get the current file's SHA
    const currentFileResponse = await fetch(apiUrl, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    if (!currentFileResponse.ok) {
      throw new Error(`Failed to fetch current file: ${currentFileResponse.statusText}`);
    }
    const fileData = await currentFileResponse.json();
    const currentSha = fileData.sha;

    // 2. Update the file
    const updateResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'docs: update FAQ via admin panel',
        content: Buffer.from(newFaqContent).toString('base64'),
        sha: currentSha,
      }),
    });

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.text();
      throw new Error(`Failed to update file: ${updateResponse.statusText} - ${errorBody}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'FAQ updated successfully!' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error: ${error.message}` }),
    };
  }
};
