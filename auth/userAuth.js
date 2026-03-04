const jwt = require('jsonwebtoken')
const result = require('../utils/result')
const config = require('../utils/config')

function authUser(req, res, next) {
    // for checking incoming requests and decrypt the token for different incoming request 

    // Define public routes
    const publicRoutes = ['/signUp', '/signin'];
    const publicGetRoutes = ['/restaurant', '/categories', '/menuItems', '/coupons'];

    // Check if route is public or OPTIONS method (CORS preflight)
    if (req.method === 'OPTIONS' || publicRoutes.includes(req.path) || (req.method === 'GET' && publicGetRoutes.includes(req.path))) {
        next()
    } else {
        const authHeader = req.headers.authorization
        const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

        if (token) {
            try {
                const payload = jwt.verify(token, config.secret)
                req.headers.user_id = payload.user_id
                next()
            } catch (e) {
                console.log(e)
                res.send(result.createResult("Token Invalid"))
            }
        } else {
            res.send(result.createResult("Token Missing"))
        }
    }
}

module.exports = authUser