
const https = require('https');

const apiKey = 'AIzaSyBsmQm-CL8coXeUbJECWLLrWS2AkjXtQYk';

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models?key=${apiKey}`,
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        const data = JSON.parse(body);
        console.log('Available Models:');
        data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${m.name} (Version: ${m.version})`);
            }
        });
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
