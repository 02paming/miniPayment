const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();

const PORT = 3000;




//메일 보내기
//----------------------------------------------------------------------------------------------------------------------------

// const express = require('express');
// const fs = require('fs');
// const path = require('path');
const nodemailer = require('nodemailer');

// const app = express();
// const PORT = 3000;

// 기본 설정
app.use(express.json()); //이 설정으로 JSON 형태의 요청 바디를 파싱할수있음

// 쿠키 설정(웹 브라우저가 보낸 쿠키를  미들웨어를 앱에 적용)
app.use(cookieParser());

// 1. 메인 페이지 GET 요청
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mini.html'));
});

// 회원 로그인 페이지
app.get('/loginPage', (req,res) => {
    res.sendFile(path.join(__dirname,'loginPage.html'));
})





// 2. 이메일 발송 POST 요청
app.post('/send-email', (req, res) => {
    // express.json() 덕분에 req.body에서 바로 데이터를 꺼낼 수 있습니다.
    const { title, content } = req.body;

    // 네이버 SMTP 발신자 정보 설정
    const transporter = nodemailer.createTransport({
        host: 'smtp.naver.com',
        port: 465,
        secure: true,
        auth: {
            user: '02paming@naver.com', // 내 네이버 이메일 전체 주소
            pass: '3BBPSMEFPUWJ' // 일반 PW 또는 2단계 인증 시 '앱 비밀번호'
        }
    });

    // 메일 내용 설정
    const mailOptions = {
        from: '02paming@naver.com', // 보내는 사람 (위 user와 동일)
        to: 'paming1075@gmail.com', // 테스트 메일을 받아볼 이메일 주소
        subject: title,
        html: content
    };

    // 실제 발송 프로세스 실행
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('발송 에러 내용:', error);
            return res.status(500).json({ 
                success: false, 
                message: `발송 실패: ${error.message}` 
            });
        }
        
        console.log('발송 성공 ID:', info.messageId);
        res.json({ 
            success: true, 
            message: '🚀 이메일이 성공적으로 날아갔습니다!' 
        });
    });
});


//----------------------------------------------------------------------------------------------------------------------------

// 카카오 설정
// 카카오 REST API 키
const REST_API_KEY = '05abe5ac038d15ff75e6137aba0e4cb4';

// 카카오 Client Secret
const CLIENT_SECRET = '5qhX8lLtRyIrs3vKAYa27b4chdNTgBSx';

// 카카오 개발자 콘솔에 등록한 Redirect URI
const REDIRECT_URI = 'http://localhost:3000/auth/kakao/callback';


app.use(
    session({
        secret: 'my-secret-key-change-this',
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false
        }
    })
);


// 프론트 파일 제공
app.use(express.static(path.join(__dirname, 'public')));


// 1. 메인 페이지
app.get('/index.html', (req, res) => {

    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );

});


// 2. 카카오 로그인 시작
app.get('/kakao-login', (req, res) => {

    const forceLogin = req.cookies.force_kakao_login === 'true';

    let kakaoAuthUrl =
        'https://kauth.kakao.com/oauth/authorize' +
        `?client_id=${encodeURIComponent(REST_API_KEY)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        '&response_type=code' +
        '&scope=talk_message';

    console.log('카카오 로그인으로 이동');

    if (forceLogin) {
        kakaoAuthUrl += '&prompt=login';
    }

    res.redirect(kakaoAuthUrl);

});


// 3. 카카오 로그인 CALLBACK
app.get('/auth/kakao/callback', async (req, res) => {

    const { code, error, error_description } = req.query;

    // 사용자가 로그인 취소
    if (error) {
        console.error(
            '카카오 로그인 취소:',
            error,
            error_description
        );

        return res.send(`
            <h2>카카오 로그인이 취소되었습니다.</h2>
            <a href="/">다시 로그인</a>
        `);
    }


    if (!code) {
        return res.status(400).send(
            '카카오 인증 code가 없습니다.'
        );

    }


    try {

        // code → access token
        const tokenResponse = await axios.post(
            'https://kauth.kakao.com/oauth/token',
            null,
            {
                params: {
                    grant_type: 'authorization_code',

                    client_id: REST_API_KEY,

                    client_secret: CLIENT_SECRET,

                    redirect_uri: REDIRECT_URI,

                    code: code
                },

                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded;charset=utf-8'
                }
            }
        );


        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token;

        console.log('============================');
        console.log('카카오 로그인 성공');
        console.log('access token 발급 성공');
        console.log('============================');

    
        // 2. 카카오 사용자 정보 가져오기
        const userResponse = await axios.get(
            'https://kapi.kakao.com/v2/user/me',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

        const userInfo = userResponse.data;

        console.log('카카오 사용자 정보:', userInfo);
        
        
        // 세션에 저장
        req.session.kakaoLoggedIn = true;

        req.session.kakaoAccessToken = accessToken;

        req.session.kakaoRefreshToken = refreshToken;

        req.session.user = userInfo;

        // 강제 로그인 플래그 제거
        res.clearCookie('force_kakao_login');

        // 결제 페이지로 이동
        res.redirect('/payment.html');


    } catch (error) {

        console.error(
            '카카오 토큰 발급 실패:',
            error.response?.data || error.message
        );

        res.status(500).send(`
            <h2>카카오 로그인 처리 중 오류가 발생했습니다.</h2>
            <pre>
            ${JSON.stringify(error.response?.data || error.message,null,2)}
            </pre>
            <a href="/">처음으로</a>
        `);

    }

});


// 4. 로그인 상태 확인
app.get('/api/login-status', (req, res) => {

    res.json({
        loggedIn : req.session.kakaoLoggedIn === true
    });

});


// 5. 결제하기
app.post('/api/payment', async (req, res) => {

    try {


        // 로그인 확인
        if (!req.session.kakaoLoggedIn) {

            return res.status(401).json({
                success: false,
                message: '카카오 로그인이 필요합니다.'
            });
        }

        
        // access token 가져오기
        const accessToken = req.session.kakaoAccessToken;


        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: '카카오 access token이 없습니다.'
            });

        }

        // 여기서 실제 결제가 이루어졌다고 가정
       const {productName,price} = req.body;

        console.log('결제 처리');

        console.log({
            productName,
            price
        });


        // 카카오톡 "나에게 보내기"
        const templateObject = {
            object_type: 'text',

            text:
                '💳 결제가 완료되었습니다.\n\n' +
                `상품명: ${productName}\n` +
                `결제금액: ${price.toLocaleString()}원`,

            link: {
                web_url:
                    'http://localhost:3000/payment.html',

                mobile_web_url:
                    'http://localhost:3000/payment.html'
            },

            button_title: '결제 확인하기'

        };


        const messageResponse = await axios.post(
            //주소
            'https://kapi.kakao.com/v2/api/talk/memo/default/send',

            //body
                new URLSearchParams({
                    template_object:
                        JSON.stringify(templateObject)
                }),

            //header
                {
                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,

                        'Content-Type':
                            'application/x-www-form-urlencoded;charset=utf-8'
                    }
                }

            );

        console.log('카카오톡 메시지 전송 결과:', messageResponse.data);

        // 성공
        res.json({
            success: true,
            message:
                '결제가 완료되었고 카카오톡 알림을 보냈습니다.'
        });


    } catch (error) {
        console.error(
            '결제 또는 카카오 메시지 오류:',
            error.response?.data || error.message
        );


        res.status(500).json({
            success: false,

            message:
                '결제 처리 또는 카카오톡 알림에 실패했습니다.',

            error:
                error.response?.data || error.message

        });

    }

});


// 6. 로그아웃(카카오톡 )
app.get('/logout', (req, res) =>    {
    req.session.destroy((err) => {

        //예외처리
        if (err) {
            console.error('세션 삭제 실패:', err);
            return res.status(500).send('로그아웃 처리 중 오류가 발생했습니다.');
        }

        //쿠키
        res.cookie('force_kakao_login', 'true', {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 10 * 60 * 1000 // 10분
        });
        
        //팝업창 닫기
        res.send(`
                <script>
                    window.close();
                </script>
        `);
    })
});



// 서버 시작
app.listen(PORT, () => {
    console.log('================================');
    console.log('서버 실행');
    console.log(`http://localhost:${PORT}`);
    console.log('================================');
});