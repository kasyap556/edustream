import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// POST /api/notify — send email notifications via Gmail
// Uses Gmail SMTP via nodemailer if configured, or logs a placeholder
export async function POST(req: NextRequest) {
    const session = await auth();

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { to, subject, type, groupName, senderName, preview, invitedBy, scheduledTime } = body;

    if (!to || !subject) {
        return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
    }

    const recipients = Array.isArray(to) ? to : [to];

    // Build HTML email body based on type
    let htmlBody = '';

    if (type === 'group_message') {
        htmlBody = `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📬 New Message in EduStream</h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #a1a1aa; margin-bottom: 8px;">Group</p>
          <h2 style="color: #e0e0e0; margin: 0 0 20px;">${groupName || 'Unknown Group'}</h2>
          
          <div style="background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #7c3aed; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">From ${senderName || 'Someone'}</p>
            <p style="color: #e0e0e0; margin: 0; font-size: 16px; line-height: 1.6;">${preview || 'Sent a message'}</p>
          </div>
          
          <a href="${process.env.NEXTAUTH_URL}/groups" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Message →</a>
        </div>
        <div style="padding: 20px 32px; border-top: 1px solid #2a2a4a; text-align: center;">
          <p style="color: #52525b; font-size: 12px; margin: 0;">EduStream Academic Platform · You received this because you're a group member.</p>
        </div>
      </div>
    `;
    } else if (type === 'group_invite') {
        htmlBody = `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎉 You've been added to a Group</h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #a1a1aa; margin-bottom: 8px;">${invitedBy || 'A teacher'} added you to:</p>
          <h2 style="color: #e0e0e0; margin: 0 0 24px;">${groupName || 'Unknown Group'}</h2>
          <a href="${process.env.NEXTAUTH_URL}/groups" style="display: inline-block; background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Group →</a>
        </div>
        <div style="padding: 20px 32px; border-top: 1px solid #2a2a4a; text-align: center;">
          <p style="color: #52525b; font-size: 12px; margin: 0;">EduStream Academic Platform</p>
        </div>
      </div>
    `;
    } else if (type === 'group_schedule') {
        htmlBody = `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #d97706, #ea580c); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📅 Meeting Scheduled</h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #a1a1aa; margin-bottom: 8px;">Group: ${groupName || 'Unknown Group'}</p>
          <p style="color: #e0e0e0; margin-bottom: 8px;">By: ${senderName || 'Teacher'}</p>
          <p style="color: #e0e0e0; margin-bottom: 24px;"><strong>When:</strong> ${scheduledTime || 'TBD'}</p>
          <a href="${process.env.NEXTAUTH_URL}/groups" style="display: inline-block; background: linear-gradient(135deg, #d97706, #ea580c); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Details →</a>
        </div>
        <div style="padding: 20px 32px; border-top: 1px solid #2a2a4a; text-align: center;">
          <p style="color: #52525b; font-size: 12px; margin: 0;">EduStream Academic Platform</p>
        </div>
      </div>
    `;
    }

    // Try to send via nodemailer if SMTP is configured
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    if (smtpUser && smtpPass) {
        try {
            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.default.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: false,
                auth: { user: smtpUser, pass: smtpPass },
            });

            await Promise.allSettled(
                recipients.map(email =>
                    transporter.sendMail({
                        from: `"EduStream" <${smtpUser}>`,
                        to: email,
                        subject,
                        html: htmlBody,
                    })
                )
            );

            console.log(`✅ Email sent to ${recipients.length} recipients`);
            return NextResponse.json({ success: true, sent: recipients.length });
        } catch (err: any) {
            console.error('Email send error:', err);
            return NextResponse.json({ success: false, error: err.message });
        }
    }

    // No SMTP configured — log and return ok (graceful degradation)
    console.log(`📧 [Email not configured] Would have sent "${subject}" to:`, recipients);
    return NextResponse.json({ success: true, simulated: true, recipients });
}
