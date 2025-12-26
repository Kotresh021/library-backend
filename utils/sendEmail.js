import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    // 1. Create Transporter (Using Gmail for example)
    // You should put these in .env file, but for the project code:
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER, // e.g. "your.library@gmail.com"
            pass: process.env.EMAIL_PASS  // e.g. "xxxx xxxx xxxx xxxx" (App Password)
        }
    });

    // 2. Define Email Options
    const mailOptions = {
        from: '"PolyLibrary" <noreply@polylibrary.com>',
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html || options.message // <--- Use passed HTML, or fallback to text
    };

    // 3. Send Email
    await transporter.sendMail(mailOptions);
};

export default sendEmail;