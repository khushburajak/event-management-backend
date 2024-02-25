import { randomBytes } from "crypto";
import { Router } from "express";
import { join } from "path";
import { DOMAIN } from "../constants";
import sendMail from "../functions/email-sender";
import { userAuth } from "../middlewares/auth-guard";
import Validator from "../middlewares/validator-middleware";
import { User } from "../models";
import {
  AuthenticateValidations,
  RegisterValidations,
  ResetPassword
} from "../validators";

const router = Router();

/**
 * @description To create a new User Account
 * @api /users/api/register
 * @access Public
 * @type POST
 */
router.post(
  "/api/register",
  RegisterValidations,
  Validator,
  async (req, res) => {
    try {
      let { username, email } = req.body;
      console.log(username,password)
      // Check if the username is taken or not
      let user = await User.findOne({ username });
      if (user) {
        return res.status(400).json({
          success: false,
          message: "Username is already taken.",
        });
      }
      // Check if the user exists with that email
      user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({
          success: false,
          message:
            "Email is already registered. Did you forget the password. Try resetting it.",
        });
      }
      user = new User({
        ...req.body,
        verificationCode: randomBytes(20).toString("hex"),
      });
      await user.save();
      // Send the email to the user with a varification link
      let html = `
        <div>
            <h1>Hello, ${user.username}</h1>
            <p>Please click the following link to verify your account</p>
            <a href="${DOMAIN}users/verify-now/${user.verificationCode}">Verify Now</a>
        </div>
    `;
      await sendMail(
        user.email,
        "Verify Account",
        "Please verify Your Account.",
        html
      );
      return res.status(201).json({
        success: true,
        message:
          "Hurray! your account is created please verify your email address.",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "An error occurred.",
      });
    }
  }
);

/**
 * @description To verify a new user's account via email
 * @api /users/verify-now/:verificationCode
 * @access PUBLIC <Only Via email>
 * @type GET
 */
router.get("/verify-now/:verificationCode", async (req, res) => {
  try {
    let { verificationCode } = req.params;
    let user = await User.findOne({ verificationCode });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access. Invalid verification code.",
      });
    }
    user.verified = true;
    user.verificationCode = undefined;
    await user.save();
    return res.sendFile(
      join(__dirname, "../templates/verification-success.html")
    );
  } catch (err) {
    console.log("ERR", err.message);
    return res.sendFile(join(__dirname, "../templates/errors.html"));
  }
});

/**
 * @description To authenticate an user and get auth token
 * @api /users/api/authenticate
 * @access PUBLIC
 * @type POST
 */
router.post(
  "/api/authenticate",
  AuthenticateValidations,
  Validator,
  async (req, res) => {
    try {
      let { username, password } = req.body;
      let user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Invalid Credentials.",
        });
      }
      if (user.verified != true) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access. Please verify your account.",
        });
      }
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({
          success: false,
          message: "Invalid Credentials.",
        });
      }
      let token = await user.generateJWT();
      return res.status(200).json({
        success: true,
        user: user.getUserInfo(),
        token: `Bearer ${token}`,
        message: "Hurray! You are now logged in.",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "An error occurred.",
      });
    }
  }
);

/**
 * @description To get the authenticated user's profile
 * @api /users/api/authenticate
 * @access Private
 * @type GET
 */
router.get("/api/authenticate", userAuth, async (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});

/**
 * @description To initiate the password reset process
 * @api /users/api/reset-password
 * @access Public
 * @type POST
 */
router.put(
  "/api/reset-password",
  ResetPassword,
  Validator,
  async (req, res) => {
    try {
      let { email } = req.body;
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User with the email is not found.",
        });
      }
      user.generatePasswordReset();
      await user.save();
      // Sent the password reset Link in the email.
      let html = `
        <div>
            <h1>Hello, ${user.username}</h1>
            <p>Please click the following link to reset your password.</p>
            <p>If this password reset request is not created by your then you can inore this email.</p>
            <a href="${DOMAIN}users/reset-password-now/${user.resetPasswordToken}">Verify Now</a>
        </div>
      `;
      await sendMail(
        user.email,
        "Reset Password",
        "Please reset your password.",
        html
      );
      return res.status(200).json({
        success: true,
        message: "Password reset link is sent your email.",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "An error occurred.",
      });
    }
  }
);

/**
 * @description To resnder reset password page
 * @api /users/reset-password/:resetPasswordToken
 * @access Restricted via email
 * @type GET
 */
router.get("/reset-password-now/:resetPasswordToken", async (req, res) => {
  try {
    let { resetPasswordToken } = req.params;
    let user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpiresIn: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Password reset token is invalid or has expired.",
      });
    }
    return res.sendFile(join(__dirname, "../templates/password-reset.html"));
  } catch (err) {
    return res.sendFile(join(__dirname, "../templates/errors.html"));
  }
});

/**
 * @description To reset the password
 * @api /users/api/reset-password-now
 * @access Restricted via email
 * @type POST
 */
router.post("/api/reset-password-now", async (req, res) => {
  try {
    let { resetPasswordToken, password } = req.body;
    let user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpiresIn: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Password reset token is invalid or has expired.",
      });
    }
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresIn = undefined;
    await user.save();
    // Send notification email about the password reset successfull process
    let html = `
        <div>
            <h1>Hello, ${user.username}</h1>
            <p>Your password is resetted successfully.</p>
            <p>If this rest is not done by you then you can contact our team.</p>
        </div>
      `;
    await sendMail(
      user.email,
      "Reset Password Successful",
      "Your password is changed.",
      html
    );
    return res.status(200).json({
      success: true,
      message:
        "Your password reset request is complete and your password is resetted successfully. Login into your account with your new password.",
    });
  } catch (err) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong.",
    });
  }
});

/**
 * @description To change the password by Authenticated user
 * @api /users/api/change-password
 * @access Private
 * @type PUT
 */

// router.put("/api/change-password", userAuth,function (req, res) {
//   const userID = req.user._id;
//   const oldPassword = req.body.oldPassword;
//   const newPassword = req.body.newPassword;
//   User.findOne({ _id: userID }).then(function (data) {
//     bcrypt.compare(oldPassword, data.password, function (err, result) {
//       if (result) {
//         bcrypt.hash(newPassword, 12, function (err, hash12) {
//           var password = { newPassword: hash12 };
//           User.updateOne({ _id: userID }, { password: hash12 })
//             .then(function (result) {
//               if (result) {
//                 res
//                   .status(201)
//                   .json({ success: true, message: "Password changed!" });
//               }
//             })
//             .catch(function (e) {
//               res.status(403).json({ message: e });
//             });
//         });
//       } else {
//         res.status(401).json({ message: "Invalid Password!" });
//       }
//     });
//   });
// });
export default router;
