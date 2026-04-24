exports.handler = async function(event) {
  if(event.httpMethod !== 'POST') return {statusCode:405,body:'Method Not Allowed'};
  
  try {
    const {to, subject, html} = JSON.parse(event.body);
    
    const res = await fetch('https://api.resend.com/emails', {
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
    
    const data = await res.json();
    return {
      statusCode: res.ok ? 200 : 400,
      body: JSON.stringify(data)
    };
  } catch(err) {
    return {statusCode:500, body: JSON.stringify({error: err.message})};
  }
};
