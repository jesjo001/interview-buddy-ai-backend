import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API = process.env.BACKEND_URL || 'http://localhost:5000';

// Ensure axios includes credentials/cookies for all requests
axios.defaults.withCredentials = true;

(async () => {
  try {
    console.log('Starting smoke test...');

    const testEmail = `smoketest+${Date.now()}@example.com`;
    // Password must match Joi validator (alphanumeric 3-30)
    const password = 'Password123';

    // Register
    console.log('Registering user', testEmail);
    const registerResp = await axios.post(`${API}/api/auth/register`, {
      name: 'Smoke Test',
      email: testEmail,
      password,
    });
    console.log('Register response:', registerResp.status);

    // Login
    console.log('Logging in');
    const loginResp = await axios.post(
      `${API}/api/auth/login`,
      { email: testEmail, password },
      { withCredentials: true }
    );
    console.log('Login response:', loginResp.status);

    // Capture cookies set by the server and forward them for subsequent requests
    const setCookie = loginResp.headers && loginResp.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.map((c: string) => c.split(';')[0]).join('; ') : undefined;

    // Create interview prep
    console.log('Creating interview prep');
    const createResp = await axios.post(
      `${API}/api/interview-preps`,
      {
        jobDescription: 'This is a sample job description for a Software Engineer role focusing on Node.js and React.',
        interviewDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        preferences: { dailyStudyTime: 60, learningStyle: 'visual' }
      },
      { withCredentials: true, headers: cookieHeader ? { Cookie: cookieHeader } : undefined }
    );

    console.log('Create prep response:', createResp.status, createResp.data);

    console.log('Smoke test finished — verification: check job queue or worker logs for processing.');
  } catch (err: any) {
    // Improved error diagnostics
    console.error('Smoke test failed:');
    if (err?.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
    console.error('Error message:', err?.message || err);
    console.error('Stack:', err?.stack || 'no stack');
    process.exit(1);
  }
})();
