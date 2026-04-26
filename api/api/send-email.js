export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, subject, html } = req.body;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'AENA Sistema <onboarding@resend.dev>',
        to: [to],
        subject,
        html
      })
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : 400).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
