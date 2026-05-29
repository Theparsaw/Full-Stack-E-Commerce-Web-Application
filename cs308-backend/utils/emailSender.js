const nodemailer = require("nodemailer");

const createTransporter = async () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  const testAccount = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

const sendInvoiceEmail = async (toEmail, invoiceNumber, pdfBuffer) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || '"CS308 Store" <noreply@cs308store.com>',
      to: toEmail,
      subject: `Your Invoice for Order #${invoiceNumber} - CS308 Store`,
      text: "Thank you for choosing CS308 Store! Please find your invoice attached.",
      attachments: [
        {
          filename: `Invoice_${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`Invoice email sent to ${toEmail}`);
    if (previewUrl) {
      console.log("Preview URL: %s", previewUrl);
    }
    
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};

const sendRefundApprovedEmail = async (toEmail, customerName, refundAmount, productNames) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || '"CS308 Store" <noreply@cs308store.com>',
      to: toEmail,
      subject: `Your Refund of $${Number(refundAmount).toFixed(2)} Has Been Approved - CS308 Store`,
      text: `Dear ${customerName},\n\nGreat news! Your return request has been approved.\n\nRefunded items: ${productNames}\nRefund amount: $${Number(refundAmount).toFixed(2)}\n\nThe refund has been processed and the items have been returned to stock.\n\nThank you for shopping with CS308 Store.`,
      html: `
        <h2>Refund Approved</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Great news! Your return request has been approved.</p>
        <table>
          <tr><td><strong>Refunded items:</strong></td><td>${productNames}</td></tr>
          <tr><td><strong>Refund amount:</strong></td><td>$${Number(refundAmount).toFixed(2)}</td></tr>
        </table>
        <p>Thank you for shopping with CS308 Store.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`Refund approval email sent to ${toEmail}`);
    if (previewUrl) console.log("Preview URL: %s", previewUrl);
    return true;
  } catch (error) {
    console.error("Refund email sending failed:", error);
    return false;
  }
};

const sendDiscountNotificationEmail = async (toEmail, customerName, productName, discountPercentage, campaignName) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || '"CS308 Store" <noreply@cs308store.com>',
      to: toEmail,
      subject: `${discountPercentage}% Off on ${productName} - Just for You!`,
      text: `Dear ${customerName},\n\nA product on your wishlist is now on sale!\n\n${productName} is now ${discountPercentage}% off as part of the "${campaignName}" campaign.\n\nDon't miss out!\n\nCS308 Store`,
      html: `
        <h2>Wishlist Item on Sale!</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>A product on your wishlist is now on sale!</p>
        <p><strong>${productName}</strong> is now <strong>${discountPercentage}% off</strong> as part of the <em>${campaignName}</em> campaign.</p>
        <p>Don't miss out!</p>
        <p>CS308 Store</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`Discount notification email sent to ${toEmail}`);
    if (previewUrl) console.log("Preview URL: %s", previewUrl);
    return true;
  } catch (error) {
    console.error("Discount notification email failed:", error);
    return false;
  }
};

module.exports = { sendInvoiceEmail, sendRefundApprovedEmail, sendDiscountNotificationEmail };
