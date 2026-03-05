import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export const authController = {

  async googleLogin(req, res) {

    try {
      const { token, role } = req.body
      console.log('Received Google login request with token:', token, 'and role:', role);

      const normalizedRole = role.toUpperCase();

      if (!token || !role) {
        return res.status(400).json({ error: 'Token and role are required' })
      }
  
      // Step 1 — Verify the token with Google
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
  
      // Step 2 — Decode it to get user info
      const payload = ticket.getPayload()
      const { sub: googleId, email, name, picture: profileImage } = payload
  
      // Step 3 — Check if user already exists in DB
      let user = await prisma.user.findUnique({
        where: { googleId },
        include: { business: true }
      })
  
      // Step 4 — If not, create them
      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            displayName: name,
            profileImage,
            role: normalizedRole,
          },
          include: { business: true }
        })
      }
  
      // Step 5 — Generate your own JWT to send back
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
  
      res.status(200).json({
        token: jwtToken,
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          profileImage: user.profileImage,
          role: user.role,
          business: user.business // null if customer
        }
      })
  
    } catch (error) {
      console.error('Google Auth Error:', error)
      res.status(401).json({ error: 'Invalid Google token' })
    }
  }
}