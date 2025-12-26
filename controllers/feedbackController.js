import Feedback from '../models/Feedback.js';
import sendEmail from '../utils/sendEmail.js';

// @desc    Submit Feedback/Request (Student)
export const submitFeedback = async (req, res) => {
    try {
        const { message } = req.body;
        const feedback = await Feedback.create({
            user: req.user._id,
            message
        });
        res.status(201).json(feedback);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get All Feedbacks (Staff & Admin)
export const getAllFeedbacks = async (req, res) => {
    try {
        let feedbacks = await Feedback.find()
            .populate('user', 'name registerNumber email')
            .populate('replyBy', 'name')
            .sort({ createdAt: -1 });

        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Reply to Feedback (Admin/Staff)
export const replyFeedback = async (req, res) => {
    try {
        // 1. Find Feedback and populate user to get email
        const feedback = await Feedback.findById(req.params.id).populate('user');

        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

        // 2. Update Feedback
        feedback.reply = req.body.reply;
        feedback.replyBy = req.user._id;
        feedback.isResolved = true;
        await feedback.save();

        // 3. Send Styled Email Notification
        if (feedback.user && feedback.user.email) {

            // HTML Template for Email
            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .header { background-color: #2c3e50; color: #ffffff; padding: 25px; text-align: center; }
                .header h2 { margin: 0; font-size: 22px; }
                .content { padding: 30px; color: #333333; line-height: 1.6; }
                .request-box { background-color: #f8f9fa; border-left: 4px solid #95a5a6; padding: 15px; margin: 20px 0; font-style: italic; color: #555; }
                .reply-box { background-color: #eafaf1; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0; }
                .footer { background-color: #f1f2f6; padding: 15px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; }
                .btn { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>📚 GPTK Library Update</h2>
                </div>
                <div class="content">
                  <p>Hello <strong>${feedback.user.name}</strong>,</p>
                  <p>You recently submitted a request or feedback. The library staff has responded to your inquiry.</p>
                  
                  <div class="request-box">
                    <div style="font-size: 12px; font-weight: bold; color: #999; margin-bottom: 5px;">YOUR REQUEST:</div>
                    "${feedback.message}"
                  </div>

                  <div class="reply-box">
                    <div style="font-size: 12px; font-weight: bold; color: #27ae60; margin-bottom: 5px;">LIBRARY RESPONSE:</div>
                    <strong>"${feedback.reply}"</strong>
                  </div>

                  <p>If you have any further questions, please visit the library circulation desk.</p>
                  
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="http://localhost:3000" class="btn">Login to Dashboard</a>
                  </div>
                </div>
                <div class="footer">
                  &copy; ${new Date().getFullYear()} Government Polytechnic, Kampli • Library System
                </div>
              </div>
            </body>
            </html>
            `;

            try {
                await sendEmail({
                    email: feedback.user.email,
                    subject: 'Response to your Library Request - GPTK',
                    message: `Your request: ${feedback.message}\n\nReply: ${feedback.reply}`, // Fallback text
                    html: emailHtml // Styled HTML
                });
            } catch (emailError) {
                console.error("Failed to send reply email:", emailError.message);
            }
        }

        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get My Feedbacks (Student)
export const getMyFeedbacks = async (req, res) => {
    try {
        const feedbacks = await Feedback.find({ user: req.user._id })
            .populate('replyBy', 'name')
            .sort({ createdAt: -1 });
        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};