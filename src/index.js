//@flow

import * as React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import {all, create} from 'mathjs'

const config = {
  matrix: "Array",
};
const math = create(all, config);

type Vec = Array<number>;
type Mat = Array<Vec>;
type Rect = DOMRect | ClientRect;

class Editor extends React.Component<{}, {css:string, currentEmojiName:string}> {

  state: {
    css: string,
    currentEmojiName: string,
  };

  constructor (props) {
    super(props);
    
    this.state = {
      css: "",
      currentEmojiName: "",
    }

    fetch('default-style.css')
      .then(response => response.text())
      .then(text => this.setState({css:text}));
  }

  render() {
    return (
      <div className="split" style={{width:"auto", height:"99vh"}}>
        <div id="left-side" style={{display:"flex", height: "100%", flex:"1 1 50%"}}>
          <AnimationEditor emojiName={this.state.currentEmojiName} controlPointSize={5}></AnimationEditor>
        </div>

        <div id="right-side" style={{flex:"1 1 50%"}}>
          <div id="preview-panel-outer">
            <div id="preview-panel-inner">
              <YTChatRoom handleOnClick={(name) => this.handleOnClick(name)}></YTChatRoom>
            </div>
          </div>
          
          <label htmlFor="css-input-field">css:</label>
          <br/>
          <textarea 
              id="css-input-field"
              onChange={(e)=>this.handleCssTextChange(e)}
              value={this.state.css}>
          </textarea>
          <style id="custom-style">
            {this.state.css}
          </style>
        
        </div>
      </div>
    )
  }


  handleCssTextChange(event) {
    this.setState({css: event.target.value})
  }

  handleOnClick(emojiName) {
    this.setState({currentEmojiName: emojiName});
  }
}



type AnimationEditorProps = {
  emojiName: string,
  controlPointSize: number,
  gridSize: number,
}

type AnimationEditorState = {
  corners: Array<Vec>,
  transform: string,
  keyframes: Array<any>,
  time: number,
  emojiCss: string,
  viewPos: Vec,
  viewScale: number,
  viewUpdated: boolean,
  lastMousePos: ?Vec,
}

class AnimationEditor extends React.Component<AnimationEditorProps, AnimationEditorState> {

  static defaultProps = {
    emojiName: "",
    controlPointSize: 5,
    gridSize: 10,
  }

  state = {
    corners: [[-1,1], [1,1], [1,-1], [-1,-1]],
    transform: "",
    keyframes: [],
    time: 0,
    emojiCss: "#editing-emoji {transform: scale(1.0)}",
    viewPos: [0, 0],
    viewScale: 1.0,
    viewUpdated: false,
    lastMousePos: null,
  }

  render() {
    const emojiName = this.props.emojiName;
    const alt = emojiNameToAlt(emojiName);


    const viewportDiv = (
      <div id="viewport" 
        style={{
          position:"absolute",
          transformOrigin: "top left",
          transform:`scale(${this.state.viewScale}) translate${vecToStr(neg(this.state.viewPos))}`
        }}>
        <YTChatRoomStructure>
          <YTChatMessage authorName="ZAKO">
            {alt ? alt : "Select an emoji to edit"}
            <YTEmoji id="editing-emoji" emojiName={emojiName} draggable="false" style={{userDrag: "none", userSelect:"none"}}></YTEmoji>
            {alt}
          </YTChatMessage>
        </YTChatRoomStructure>
      </div>
    );
    

    const controlPoints = [];
    const grids = [];
    let overlayDiv = (
      <div id="viewport-overlay" onMouseDown={this.handleMouseDown} onMouseMove={this.handleMouseMove} onMouseUp={this.handleMouseUp}>
        <svg style={{position: "absolute", width:"100%", height:"100%", zIndex:0}}>
          {grids}
        </svg>
        <svg style={{position: "absolute", width:"100%", height:"100%", zIndex:3}}>
          {controlPoints}
        </svg>
      </div>
    );

    const corners = this.calculateConers();
    for (let i=0; i<4; i++) {
      controlPoints.push(
        <rect className="control-point"
          width={this.props.controlPointSize} height={this.props.controlPointSize}
          key = {i}
          style={{transform:`translate${vecToStr(corners[i])}`}}/>
      )
    }


    const originPos = this.worldToScreen([0,0]);
    grids.push(
      <circle
        cx={originPos[0]}
        cy={originPos[1]}
        r="5"
        stroke="black" strokeWidth="2" fill="grey"
        key={0} />
    )

    for (let i=-30; i<=50; i++) {
      let p = math.dotMultiply([i,i], this.props.gridSize)
      p = this.worldToScreen(p)
      grids.push(
        <line x1={p[0]} y1={-1e5} x2={p[0]} y2={1e5} strokeWidth={1} key={"x"+i} stroke="grey"/>
      )
      grids.push(
        <line x1={-1e5} y1={p[1]} x2={1e5} y2={p[1]} strokeWidth={1} key={"y"+i} stroke="grey"/>
      )
    }

    const toolbar = (
      <div id="animation-editor-tool">
        <button id="record-button"> ● </button>
        <input
          id="timeline" type="range" name="timeline" min="0" max="1" step="0.01"
          value={this.state.time}/>
      </div>
    );

    return (
      <div id="animation-editor">
        <div id="animation-editor-board"
          onDragOver={this.allowDrop}
          onWheel={this.handleWheelEvent}>
          {viewportDiv}
          {overlayDiv}
        </div>
        {toolbar}
        <style>{this.state.emojiCss}</style>
      </div>
    );
  }
  
  componentDidMount() {
    this.setState({viewUpdated: true});
  }

  componentDidUpdate(prevProps:AnimationEditorProps, prevState:AnimationEditorState, snapshot) {
    if (prevProps.emojiName !== this.props.emojiName
      || prevState.viewScale !== this.state.viewScale
      || prevState.viewPos !== this.state.viewPos) {
      this.setState({viewUpdated: true});
    }
  }

  getEmojiRect(): Rect|null {
    const emoji = document.querySelector("#editing-emoji");
    if (emoji !== null) {
      return emoji.getBoundingClientRect();
    }
    return null;
  }

  getContainerRect(): Rect|null {
    const container = document.querySelector("#viewport-overlay");
    if (container !== null) {
      return container.getBoundingClientRect();
    }
    return null;
  }

  calculateConers(): Array<Vec> {
    const emojiRect = this.getEmojiRect();
    const containerRect = this.getContainerRect();
    if (emojiRect == null || containerRect == null) {
      return [[0,0], [0,0], [0,0], [0,0]];
    }
    
    const coordOrigin = [containerRect.left, containerRect.top];

    const corners:Array<Vec> = [
      (math.subtract([emojiRect.left, emojiRect.top], coordOrigin) : Vec),
      (math.subtract([emojiRect.right, emojiRect.top], coordOrigin): Vec),
      (math.subtract([emojiRect.right, emojiRect.bottom], coordOrigin): Vec),
      (math.subtract([emojiRect.left, emojiRect.bottom], coordOrigin): Vec),
    ];

    for (let i = 0; i < corners.length; i++) {
      const controlPointOffset = [this.props.controlPointSize/2, this.props.controlPointSize/2]
      corners[i] = math.subtract(corners[i], controlPointOffset);
    }
    
    return corners;
  }

  handleWheelEvent = (event:WheelEvent) => {
    const scale = this.state.viewScale - event.deltaY * 0.001;
    this.setState({viewScale: scale});
  }


  handleCornorMoved(pos, index) {
    const containerRect = NotNull<Rect>(this.getContainerRect());
    let corners = Array.from(this.state.corners);
    corners[index] = math.subtract(pos, [containerRect.left, containerRect.top]);
    this.setState({corners: corners})
  }

  allowDrop = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  handleMouseDown = (event) => {
    const lastMousePos = this.state.lastMousePos;
    const mousePos = [event.clientX, event.clientY];
    if (lastMousePos == null) {
      this.setState({lastMousePos: mousePos});
    }
  }

  handleMouseMove = (event) => {
    const lastMousePos = this.state.lastMousePos;
    const mousePos = [event.clientX, event.clientY];
    const viewPos = this.state.viewPos;
    if (lastMousePos != null) {
      const displacement = math.dotDivide(math.subtract(mousePos, lastMousePos), this.state.viewScale)
      const newViewPos = math.subtract(viewPos, displacement);
      this.setState({
        lastMousePos: mousePos,
        viewPos: newViewPos,
      });
    }
  }

  handleMouseUp = (event) => {
    this.setState({lastMousePos: null})
  }

  handleControlPointMouseDown = (event) => {
    console.log(event)
  }

  worldToScreen(p:Vec):Vec {
    return math.dotMultiply(math.subtract(p, this.state.viewPos), this.state.viewScale);
  }
  screenToWorld(p:Vec):Vec {
    return math.add(math.dotMultiply(p, 1/this.state.viewScale), this.state.viewPos);
  }
}


class YTChatRoom extends React.Component<{handleOnClick:any}, {}> {
  render() {
    return (
      <YTChatRoomStructure>
        <YTChatMessage handleOnClick={this.props.handleOnClick} authorName="ZAKO" >
          KUSA
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
        </YTChatMessage>
        <YTChatMessage handleOnClick={this.props.handleOnClick} authorName="雜魚">
          草
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
        </YTChatMessage>
        <YTChatMessage handleOnClick={this.props.handleOnClick} authorName="ざこ">
          くさ
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
          <YTEmoji emojiName=":_kusa:" handleOnClick={this.props.handleOnClick}></YTEmoji>
        </YTChatMessage>
      </YTChatRoomStructure>
    )
  }
}

function YTChatRoomStructure(props) {
  return (
    <yt-live-chat-app>
      <div id="contents" className="style-scope yt-live-chat-app">
        <yt-live-chat-renderer class="style-scope yt-live-chat-app" hide-timestamps="" has-ticker="" style={{"--scrollbar-width":"15px;"}}>
          <div id="promo" className="style-scope yt-live-chat-renderer"></div>
          <iron-pages id="content-pages" class="style-scope yt-live-chat-renderer">
            <div id="chat-messages" className="style-scope yt-live-chat-renderer iron-selected">
              <yt-live-chat-header-renderer role="heading" class="style-scope yt-live-chat-renderer">
                <div id="primary-content" className="style-scope yt-live-chat-header-renderer">
                </div>
                <div id="action-buttons" className="style-scope yt-live-chat-header-renderer">
                </div>
                <yt-icon-button id="overflow" class="style-scope yt-live-chat-header-renderer" touch-feedback="">
                </yt-icon-button>
              </yt-live-chat-header-renderer>
              <dom-if class="style-scope yt-live-chat-renderer"><template is="dom-if"></template></dom-if>
              <div id="contents" className="style-scope yt-live-chat-renderer">
                <div id="ticker" className="style-scope yt-live-chat-renderer"></div>
                <div id="separator" className="style-scope yt-live-chat-renderer"></div>
                <div id="chat" className="style-scope yt-live-chat-renderer">
                  <yt-live-chat-pinned-message-renderer id="pinned-message"
                    disable-upgrade="" hidden="" class="style-scope yt-live-chat-renderer">
                  </yt-live-chat-pinned-message-renderer>
                  <div id="item-list" className="style-scope yt-live-chat-renderer">
                    <yt-live-chat-item-list-renderer class="style-scope yt-live-chat-renderer" allow-scroll="">
                      <div id="contents" className="style-scope yt-live-chat-item-list-renderer">
                        <div id="item-scroller" className="style-scope yt-live-chat-item-list-renderer animated">
                          <yt-live-chat-docked-message-renderer id="docked-messages"></yt-live-chat-docked-message-renderer>
                          <yt-live-chat-banner-manager id="live-chat-banner" class="style-scope yt-live-chat-item-list-renderer">
                          </yt-live-chat-banner-manager>
                          <div id="item-offset" className="style-scope yt-live-chat-item-list-renderer" style={{height: "100%"}}>
                            <div id="items" className="style-scope yt-live-chat-item-list-renderer" style={{transform: "translateY(0px)"}}>
                              {props.children}
                            </div>
                          </div>
                        </div>
                      </div>
                    </yt-live-chat-item-list-renderer>
                  </div>
                </div>
              </div>
              <div id="dialog" className="style-scope yt-live-chat-renderer"></div>
            </div>
          </iron-pages>
        </yt-live-chat-renderer>
      </div>
    </yt-live-chat-app>
  )
}

function YTChatMessage(props:{authorName:string, children?:React.Node}) {
  return (
    <yt-live-chat-text-message-renderer class="style-scope yt-live-chat-item-list-renderer" author-type="">
      <yt-img-shadow id="author-photo" class="no-transition style-scope yt-live-chat-text-message-renderer"
        height="24" width="24" loaded="" style={{backgroundColor: "transparent"}}
      >
        <img id="img" className="style-scope yt-img-shadow" alt="" height="24" width="24" src="author-image.png"/>
      </yt-img-shadow>

      <div id="content" className="style-scope yt-live-chat-text-message-renderer">
        <span id="timestamp" className="style-scope yt-live-chat-text-message-renderer">1:23 PM</span>
        <yt-live-chat-author-chip class="style-scope yt-live-chat-text-message-renderer">
          <span id="author-name" dir="auto" className="style-scope yt-live-chat-author-chip">
            {props.authorName}
            <span id="chip-badges" className="style-scope yt-live-chat-author-chip"></span>
          </span>
          <yt-live-chat-author-badge-renderer class="style-scope yt-live-chat-author-chip" aria-label="新會員" type="member" shared-tooltip-text="新會員">
            <div id="image" className="style-scope yt-live-chat-author-badge-renderer">
              <img src="member.png" className="style-scope yt-live-chat-author-badge-renderer" alt="新會員"/>
            </div>
          </yt-live-chat-author-badge-renderer>
        </yt-live-chat-author-chip>
        <YTChatMessageContent>
          {props.children}
        </YTChatMessageContent>
      </div>
    </yt-live-chat-text-message-renderer>
  )
}

class YTChatMessageContent extends React.Component<{children?:React.Node}> {
  render() {
    return (
      <span id="message" dir="auto" className="style-scope yt-live-chat-text-message-renderer">
        {this.props.children}
      </span>
    );
  }
}

class YTEmoji extends React.PureComponent<{
    emojiName: string,
    style?: any,
    id?: string,
    handleOnClick?: (string) => void,
  }> {

  render() {
    const emojiName = this.props.emojiName
    const alt = emojiNameToAlt(emojiName);
    const filename = emojiNameToFileName(emojiName);

    const handleOnClick = () => {
      if (this.props !== undefined) {
        if (this.props.handleOnClick !== undefined) {
          this.props.handleOnClick(emojiName);
        }
      }
    }
     
    return (
      <img
        className="emoji yt-formatted-string style-scope yt-live-chat-text-message-renderer"
        src={filename}
        alt={alt}
        shared-tooltip-text={emojiName}
        onClick={handleOnClick}
        id={this.props.id}
        style={this.props.style}/>
    );
  }
}


function emojiNameToAlt(emojiName:string):string {
  return emojiName.replace(/^(:_)/, "")
                  .replace(/^:/, "")
                  .replace(/:$/, "");
}

function emojiNameToFileName(emojiName:string):string {
  return emojiNameToAlt(emojiName)+".png";
}


function vecToStr(v:Vec, unit='px'):string {
  let s = "(";
  for (let i = 0; i < v.length; i++) {
    s += v[i];
    if (unit !== undefined) {
      s += unit
    }

    if (i < v.length-1){
      s += ',';
    }
    else {
      s += ')';
    }
  }
  return s;
}



// ========================================

ReactDOM.render(
  <Editor />,
  NotNull<HTMLElement>(document.getElementById('root'))
);


function NotNull<T>(x: ?T): T {
  return (x: any)
}


function neg(v:Vec) : Vec{
  return [-v[0], -v[1]]
}

/*
function f() : number{
  return "123";
}
*/
