import {Router} from "express";
import {imagekit} from "../lib/imagekit.js";

const router = Router();

router.get('/auth', (req, res) => {
    try{
        const authParams = imagekit.getAuthenticationParameters();
        res.json({
            token: authParams.token,
            expire: authParams.expire,
            signature: authParams.signature,
            publicKey: process.env.IMAGEKIT_PUBLIC_KEY
        })
    }catch (err){
        console.error('Error generating authentication parameters:', err);
        res.status(500).json({ error: 'Failed to generate authentication parameters'
        })
    }
});

export default router;