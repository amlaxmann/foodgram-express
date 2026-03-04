const jwt = require('jsonwebtoken')
const result = require('../utils/result')
const config = require('../utils/config')

function restAuth(req, res, next){
    const url = req.url

    if(url === '/api/restaurants/register' || url === '/api/restaurants/signin') {
        next()
    } else {
        const token = req.headers.token
        if(token) {
            try{
                const payload = jwt.verify(token , config.secret)
                req.headers.user_id = payload.user_id
                next()
            } catch {
                res.send(result.createResult("Invalid Token"))
            }
        }
    }
}


module.exports = restAuth