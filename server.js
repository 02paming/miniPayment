const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');

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

// 세션 미들웨어 설정
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

// 1. 메인 페이지 GET 요청
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mini.html'));
});




//----------------회원가입-----------------------------------

const FILE_PATH = './users.json'; // 회원 정보가 저장될 파일 경로 //쓰기할때 없으면 새파일 생성함
// let users = [{ id: "user1", email: "a@a.com" }]; //원래 비워놔야하는데 테스트용 하드코딩 더미
let users;


// 회원 로그인 페이지
app.get('/loginPage', (req,res) => {
    res.sendFile(path.join(__dirname,'loginPage.html'));
})

// 회원가입 이동
app.get('/signUp', (req,res) => {
    res.sendFile(path.join(__dirname,'signUp.html'));
})

// 이미계정있을때 로그인페이지로 이동
app.get('/loginpage', (req,res) => {
    res.sendFile(path.join(__dirname,'loginpage.html'));
})



// 1. DB 대체 함수 node.js 기본내장 fs 활용

// 파일에서 회원 목록 읽어오기
function readUsers() {

    //아예 처음 회원가입할때 FILE_PATH 파일이 안만들어졌는데 그걸체크하는 if문
    //회원가입에서 readUsers()를 먼저 보고 회원목록을 보고 user배열에 넣기때문
    //writeUser()하면 생성되는데 그전에 readUser()를 봐서 생기는 에러
    if(fs.existsSync(FILE_PATH)){
        //현재 json형태인 텍스트 상태
        const readText = fs.readFileSync(FILE_PATH, "utf-8");
        if(readText){
            users = JSON.parse(readText)
        }
        else{
            users = []
        }
    }else{
        users = []
    }
}

// 파일에 회원 목록 저장하기
function writeUsers(users) {
    // fs 모듈을 사용해 FILE_PATH에 덮어쓰기
    // 문자열로 변환하여 파일에 쓰기 (기존 내용 덮어쓰기)
    fs.writeFileSync(FILE_PATH, JSON.stringify(users));
}


// 2. 회원가입, 로그인 기능 (API)
// 회원가입
app.post('/api/signup', (req, res) => {

    
    const { id, password, email, checkPwd ,idCheckFlag} = req.body;
    // console.log(id)
    
  //  readUsers()로 기존 유저 목록 불러오기
    readUsers();

  // 비밀번호 재입력 맞게쳤는지 검사
    //비밀번호와 비밀번호재입력이 같지않다면 
    if(!(password == checkPwd)){
        return res.json({ success: false, message: "입력하신 비밀번호가 다릅니다!" });
    }

  // 이메일관련 유효성검사도 진행하기


    if(idCheckFlag){
        return res.json({ success: false, message: "이미 사용중인 아이디입니다." });
    }else{

        //  중복이 아니면 새 유저 객체 만들어서 배열에 push
        const user = {
            u_id : id,
            u_password : password,
            u_email : email
        }

        users.push(user);

        // writeUsers()로 파일에 업데이트된 배열 저장
        writeUsers(users)
        
        // 5. 성공 메시지 응답
        res.status(201).json({
            success : true,
            message : "회원가입성공!"
        });
    }
});

//  id 중복 검사 (버튼 눌러서 업그레이드하기) 버튼눌러서 아이디 중복검사가 통과되면 플래그방식으로 트루넘기고 버튼 enable로 이제 클릭안되게 만들기 
//  false일때는 이곳에서 아이디 중복을 진행해주세요 라고 띄우기
//아이디 중복검사 기능
app.post('/api/idCheck',(req,res) => {
    const id = req.body.id

    readUsers();
    
    const duplicateUser = users.find(user => user.u_id == id);
    if(duplicateUser){
        return res.json({ success: false, message: "이미 사용중인 아이디입니다." });
    }else{
        res.status(201).json({success : true, message : "사용가능한 아이디 입니다."});
    }
})

//로그인후 메인에서 세션검사
app.get('/api/auth-status', (req, res) => {
    if (req.session.loginUser) {
    // 로그인된 상태라면 유저 아이디를 JSON으로 응답
    res.json({ isLoggedIn: true, user: req.session.loginUser });
    } else {
    // 로그인 안 된 상태라면
    res.json({ isLoggedIn: false });
    }
});

// 로그인 
app.post('/api/login', (req, res) => {
    const { id, password } = req.body;

    // 1. readUsers()로 유저 목록 불러오기
    readUsers()
    // 2. id와 password가 일치하는 유저 찾기
    const loginUser = users.find(user => user.u_id == id && user.u_password == password);
    if(loginUser){
        // 3. 일치하면 해당 유저 정보를 세션에 저장후 메인화면으로 리다이렉트
        req.session.loginUser = loginUser;
        res.redirect("/");
    }else{
        // 4. 실패 시 에러 메시지 응답
        res.send("로그인 실패!")
    }
});

// 로그아웃
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    })
});

// 결제 완료 및 이메일 발송 API (이메일 발송 POST 요청)
app.post('/send-email', (req, res) => {
    // express.json() 덕분에 req.body에서 바로 데이터를 꺼낼 수 있습니다.
    const { title, content , email} = req.body;

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
        to: email, // 테스트 메일을 받아볼 이메일 주소
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