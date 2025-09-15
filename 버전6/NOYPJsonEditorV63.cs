using System; using System.IO; using System.Linq; using System.Text;
using System.Collections.Generic; using System.Diagnostics; using System.Drawing; using System.Windows.Forms;

public class Program : Form {
  // 상단바
  ComboBox cmbBranch; TextBox txtRepo; Button btnRefresh, btnPull, btnPush, btnOpen, btnBrowser;
  // 메인/우측 분할
  SplitContainer splitMain, splitRight;
  // 사이드카
  ListBox lstActions; Label lblTitle, lblHelp; FlowLayoutPanel pnlButtons; Button btnPreview, btnApply, btnRestore;
  RichTextBox rtLog;
  string repo; string BkRoot { get { return Path.Combine(repo, ".noyp_backup"); } }

  [STAThread] public static void Main(){
    Application.EnableVisualStyles();
    Application.SetCompatibleTextRenderingDefault(false);

    // 전역 크래시 가드 (로그 + 메시지박스)
    Application.ThreadException += (s,e)=> ShowCrash(e.Exception);
    AppDomain.CurrentDomain.UnhandledException += (s,e)=> ShowCrash(e.ExceptionObject as Exception);

    try { Application.Run(new Program()); }
    catch(Exception ex){ ShowCrash(ex); }
  }
  static void ShowCrash(Exception ex){
    try{
      if(ex==null) return;
      string path = Path.Combine(Path.GetTempPath(), "noyp_v63.log");
      File.AppendAllText(path, DateTime.Now.ToString("[HH:mm:ss] ") + ex + Environment.NewLine);
      MessageBox.Show("시작/실행 오류: " + ex.Message + "\n\n로그: " + path, "NOYP v6.3b");
    }catch{}
  }

  public Program(){
    Text="NO열정페이 JSON 에디터 v6.3b (Sidecar)";
    StartPosition=FormStartPosition.CenterScreen; ClientSize=new Size(1200,740);

    //  상단 바 
    var top = new Panel(){ Dock=DockStyle.Top, Height=38 };
    Controls.Add(top);
    var lbRepo = new Label(){ Left=8,Top=11,AutoSize=true,Text="Repo:" };
    txtRepo   = new TextBox(){ Left=48,Top=8,Width=360,ReadOnly=true,BorderStyle=BorderStyle.None };
    cmbBranch = new ComboBox(){ Left=418,Top=7,Width=160,DropDownStyle=ComboBoxStyle.DropDownList };
    btnRefresh= new Button(){ Left=582,Top=6,Width=100,Text="브랜치 새로고침" };
    btnPull   = new Button(){ Left=687,Top=6,Width=70, Text="Git Pull" };
    btnPush   = new Button(){ Left=762,Top=6,Width=70, Text="Git Push" };
    btnOpen   = new Button(){ Left=837,Top=6,Width=70, Text="폴더 열기" };
    btnBrowser= new Button(){ Left=912,Top=6,Width=120,Text="미리보기(브라우저)" };
    top.Controls.AddRange(new Control[]{ lbRepo, txtRepo, cmbBranch, btnRefresh, btnPull, btnPush, btnOpen, btnBrowser });

    //  메인 분할 (Panel2MinSize 설정 제거: 시작 크래시 방지) 
    splitMain = new SplitContainer(){ Dock=DockStyle.Fill, Orientation=Orientation.Vertical, SplitterWidth=6 };
    splitMain.Panel1MinSize = 200;                 // 좌 최소만 제한
    Controls.Add(splitMain);

    // 좌측은 비워둠(추후 에디터/미리보기 자리)
    splitMain.Panel1.Controls.Add(new RichTextBox(){ Dock=DockStyle.Fill, Font=new Font("Consolas",10) });

    // 우측 내부 분할
    splitRight = new SplitContainer(){ Dock=DockStyle.Fill, Orientation=Orientation.Vertical, SplitterWidth=6 };
    splitRight.Panel1MinSize = 200;                // 액션 목록 최소만 제한
    splitMain.Panel2.Controls.Add(splitRight);

    // 좌: 액션 목록
    lstActions = new ListBox(){ Dock=DockStyle.Fill };
    lstActions.Items.Add("bypass_admin_nextjs"); lstActions.SelectedIndex = 0;
    splitRight.Panel1.Controls.Add(lstActions);

    // 우: 고정 헤더 + 버튼 + 로그
    var table = new TableLayoutPanel(){ Dock=DockStyle.Fill, ColumnCount=1, RowCount=3 };
    table.RowStyles.Add(new RowStyle(SizeType.AutoSize));
    table.RowStyles.Add(new RowStyle(SizeType.AutoSize));
    table.RowStyles.Add(new RowStyle(SizeType.Percent,100));
    splitRight.Panel2.Controls.Add(table);

    var header = new Panel(){ Dock=DockStyle.Top, AutoSize=true, AutoSizeMode=AutoSizeMode.GrowAndShrink, Padding=new Padding(6,6,6,2) };
    lblTitle = new Label(){ AutoSize=true, Font=new Font(Font,FontStyle.Bold), Text="관리자 인증 우회 (개발용)" };
    lblHelp  = new Label(){ AutoSize=true, Text="Next.js의 /admin 차단 임시 무력화. 커밋/푸시 전 원복 확인!" };
    header.Controls.Add(lblTitle); header.Controls.Add(lblHelp);
    lblHelp.Top = lblTitle.Bottom + 2; lblHelp.Left = 0;
    table.Controls.Add(header,0,0);

    pnlButtons = new FlowLayoutPanel(){ Dock=DockStyle.Top, AutoSize=true, AutoSizeMode=AutoSizeMode.GrowAndShrink, Padding=new Padding(6,0,6,4) };
    btnPreview = new Button(){ Text="미리보기", Width=80,  Margin=new Padding(0,2,6,2) };
    btnApply   = new Button(){ Text="적용(백업 생성)", Width=120, Margin=new Padding(0,2,6,2) };
    btnRestore = new Button(){ Text="원복(최근 백업)", Width=120, Margin=new Padding(0,2,6,2) };
    pnlButtons.Controls.AddRange(new Control[]{ btnPreview, btnApply, btnRestore });
    table.Controls.Add(pnlButtons,0,1);

    rtLog = new RichTextBox(){ Dock=DockStyle.Fill, ReadOnly=true, BackColor=Color.WhiteSmoke, Font=new Font("Consolas",10) };
    table.Controls.Add(rtLog,0,2);

    // 처음/리사이즈마다 안전한 분할폭으로 정렬
    EventHandler resizeSafe = (s,e)=>{
      int total = splitMain.ClientSize.Width - splitMain.SplitterWidth;
      if(total<400) total = 400;
      int rightWidth = Math.Max(360, total/3);     // 사이드카 기본 1/3 (최소 360)
      splitMain.SplitterDistance = Math.Max(splitMain.Panel1MinSize, total - rightWidth);
      int rightTotal = splitRight.ClientSize.Width - splitRight.SplitterWidth;
      if(rightTotal<320) rightTotal = 320;
      int leftList = Math.Max(splitRight.Panel1MinSize, Math.Min(260, rightTotal-200));
      splitRight.SplitterDistance = leftList;
    };
    Load += (s,e)=> resizeSafe(s,e);
    Resize += (s,e)=> resizeSafe(s,e);

    // 이벤트
    btnRefresh.Click += (s,e)=> FillBranches();
    btnPull.Click    += (s,e)=> PullRemote();
    btnPush.Click    += (s,e)=> PushRemote();
    btnOpen.Click    += (s,e)=> OpenPath(repo);
    btnBrowser.Click += (s,e)=> { try { Process.Start("http://localhost:3000/admin"); } catch {} };

    btnPreview.Click += (s,e)=> Preview_Bypass();
    btnApply.Click   += (s,e)=> Apply_Bypass();
    btnRestore.Click += (s,e)=> Restore_Bypass();

    // init
    repo = DetectRepo(); txtRepo.Text = repo; Directory.CreateDirectory(BkRoot);
    FillBranches(); Log("v6.3b ready");
  }

  //  Git helpers 
  string DetectRepo(){
    try{
      string ev=Environment.GetEnvironmentVariable("NOYP_REPO");
      if(!string.IsNullOrWhiteSpace(ev) && Directory.Exists(Path.Combine(ev,".git"))) return ev;
      string[] seeds=new string[]{ Directory.GetCurrentDirectory(), Application.StartupPath, AppDomain.CurrentDomain.BaseDirectory, Environment.CurrentDirectory, @"C:\Users\cilab\Desktop\Githeb" };
      foreach(var s in seeds){ string r=FindRepoUp(s); if(r!=null) return r; }
    }catch{}
    return @"C:\Users\cilab\Desktop\Githeb";
  }
  string FindRepoUp(string start){ try{ string d=start; while(!string.IsNullOrWhiteSpace(d)){ if(Directory.Exists(Path.Combine(d,".git"))) return d; var p=Directory.GetParent(d); if(p==null) break; d=p.FullName; } }catch{} return null; }

  void FillBranches(){
    try{
      string cur=RunGitOut("rev-parse --abbrev-ref HEAD").Trim();
      var lines=RunGitOut("branch").Split(new[]{'\n','\r'},StringSplitOptions.RemoveEmptyEntries);
      var list=lines.Select(x=>x.Trim().TrimStart('*',' ')).Where(x=>!string.IsNullOrWhiteSpace(x)).ToList();
      if(list.Count==0) list.Add("main");
      cmbBranch.Items.Clear(); foreach(var b in list) cmbBranch.Items.Add(b);
      if(!string.IsNullOrWhiteSpace(cur) && list.Contains(cur)) cmbBranch.SelectedItem=cur; else cmbBranch.SelectedIndex=0;
      Log("브랜치 로드: "+string.Join(", ", list.ToArray()));
    } catch { cmbBranch.Items.Clear(); cmbBranch.Items.Add("main"); cmbBranch.SelectedIndex=0; }
  }
  void PullRemote(){ string br=GetCurrentBranch(); RunGit("fetch origin"); int rc=RunGitRC("pull --ff-only origin "+br); Log(rc==0?"Git Pull 완료":"Git Pull 실패"); MessageBox.Show(rc==0?"Pull 완료":"Pull 실패"); }
  void PushRemote(){ string br=GetCurrentBranch(); if(RunGitRC("status --porcelain")==0){ MessageBox.Show("변경 없음"); return; } if(RunGitRC("commit -m \"chore: v63b\"")!=0){} int rc=RunGitRC("push origin "+br); Log(rc==0?"Git Push 완료":"Git Push 실패"); MessageBox.Show(rc==0?"Push 완료":"Push 실패"); }
  string GetCurrentBranch(){ try{ string br=(cmbBranch.SelectedItem!=null)?cmbBranch.SelectedItem.ToString():null; if(string.IsNullOrWhiteSpace(br)) br=RunGitOut("rev-parse --abbrev-ref HEAD").Trim(); if(string.IsNullOrWhiteSpace(br)) br="main"; return br; } catch { return "main"; } }

  void RunGit(string a){ using(var p=StartGit(a)){ p.WaitForExit(); } }
  int  RunGitRC(string a){ using(var p=StartGit(a)){ p.WaitForExit(); return p.ExitCode; } }
  string RunGitOut(string a){ using(var p=StartGit(a)){ string so=p.StandardOutput.ReadToEnd(); string se=p.StandardError.ReadToEnd(); p.WaitForExit(); return (so+"\n"+se); } }
  Process StartGit(string a){ var psi=new ProcessStartInfo("git",a){ WorkingDirectory=repo, UseShellExecute=false, RedirectStandardOutput=true, RedirectStandardError=true, CreateNoWindow=true }; return Process.Start(psi); }

  //  액션: bypass_admin_nextjs 
  void Preview_Bypass(){
    var sb=new StringBuilder();
    sb.AppendLine("== 미리보기: bypass_admin_nextjs ==");
    string[] mids=new string[]{"middleware.ts","middleware.js"};
    foreach(string f in mids){
      string p=Path.Combine(repo,f);
      if(File.Exists(p)) sb.AppendLine("이동 예정: "+f+" -> .noyp_backup/.../"+f);
      else sb.AppendLine("없음: "+f);
    }
    sb.AppendLine("생성/확인: app/admin/_bypass_dev.txt");
    Log(sb.ToString().TrimEnd());
    MessageBox.Show("미리보기는 우측 로그에서 확인하세요.");
  }
  void Apply_Bypass(){
    string tag="bypass_admin_nextjs";
    string bk=Path.Combine(BkRoot,tag,DateTime.Now.ToString("yyyyMMdd-HHmmss"));
    Directory.CreateDirectory(bk);
    string[] mids=new string[]{"middleware.ts","middleware.js"};
    foreach(string f in mids){
      string p=Path.Combine(repo,f);
      if(File.Exists(p)){
        string dst=Path.Combine(bk,f);
        Directory.CreateDirectory(Path.GetDirectoryName(dst));
        File.Move(p,dst);
        Log("백업 및 제거: "+f);
      } else Log("없음(스킵): "+f);
    }
    string adminDir=Path.Combine(repo,"app","admin"); Directory.CreateDirectory(adminDir);
    File.WriteAllText(Path.Combine(adminDir,"_bypass_dev.txt"),"bypass mark",new UTF8Encoding(false));
    Log("마커 생성: app/admin/_bypass_dev.txt");
    MessageBox.Show("적용 완료 (백업: "+bk+")");
  }
  void Restore_Bypass(){
    string tag="bypass_admin_nextjs";
    string baseDir=Path.Combine(BkRoot,tag);
    if(!Directory.Exists(baseDir)){ MessageBox.Show("백업 없음"); return; }
    var dirs=Directory.GetDirectories(baseDir).OrderByDescending(x=>x).ToList();
    if(dirs.Count==0){ MessageBox.Show("백업 없음"); return; }
    string last=dirs[0];
    foreach(string src in Directory.GetFiles(last,"*",SearchOption.AllDirectories)){
      string rel=src.Substring(last.Length+1);
      string dst=Path.Combine(repo,rel);
      Directory.CreateDirectory(Path.GetDirectoryName(dst));
      if(File.Exists(dst)) File.Delete(dst);
      File.Move(src,dst);
      Log("복원: "+rel);
    }
    string marker=Path.Combine(repo,"app","admin","_bypass_dev.txt");
    if(File.Exists(marker)){ File.Delete(marker); Log("마커 삭제: app/admin/_bypass_dev.txt"); }
    MessageBox.Show("원복 완료: "+Path.GetFileName(last));
  }

  void Log(string s){ if(rtLog==null) return; rtLog.AppendText("["+DateTime.Now.ToString("HH:mm:ss")+"] "+s+"\r\n"); }
  void OpenPath(string p){ try{ Process.Start(p);}catch{ try{ var psi=new ProcessStartInfo(p); psi.UseShellExecute=true; Process.Start(psi);}catch{} } }
}
