const Option = {
	Cesium: null,
	imageryProvider: null, // 地图底图
	skyBox: null,
	widgets: {
		geocoder: true,
		homeButton: true,
		sceneModePicker: true,
		baseLayerPicker: true,
		navigationHelpButton: true,
		animation: true,
		timeline: true,
		fullscreenButton: true,
		navigationInstructionsInitiallyVisible: true
	}
};

/**
 * CesiumPlus
 */
export default class CesiumPlus {
	constructor(cesiumContainer, option) {
		this.cesiumContainer = cesiumContainer;
		this.option = Object.assign(Option, option);
		this.Cesium = option.Cesium; // 设置 Cesium 工具
		this.Viewer = new this.Cesium.Viewer(cesiumContainer, {
			...option.widgets,
			imageryProvider: option.imageryProvider
		}); // 设置 Viewer 对象
		this.Scene = this.Viewer.scene; // 设置场景对象
		this.Camera = this.Viewer.camera; // 设置相机对象
		this.Canvas = this.Scene.canvas; // 设置 Canvas
		this.Viewer.cesiumWidget.creditContainer.style.display = 'none'; // 隐藏 cesium logo
	}

	/**
	 * 设置鼠标监听事件
	 * @param callback
	 * @param screenSpaceEventType
	 */
	bindHandelEvent(callback, screenSpaceEventType) {
		this.Viewer.screenSpaceEventHandler.removeInputAction(screenSpaceEventType);
		this.Viewer.screenSpaceEventHandler.setInputAction(callback, screenSpaceEventType);
	}

	/**
	 * Cesium鼠标框选事件
	 * @param options
	 */
	bindHandelBoxChooseEvent(options = {
		border: '1px dashed #0099FF',
		backgroundColor: '#C3D5ED',
		opacity: 0.6,
		downType: Cesium.ScreenSpaceEventType.RIGHT_DOWN,
		upType: Cesium.ScreenSpaceEventType.RIGHT_UP,
		mouseDown: (event, boxChoose) => {
		},
		mouseMove: (event, boxChoose) => {
		},
		mouseUp: (event, boxChoose) => {
		}
	}) {
		let flag = false;
		let startX = 0;
		let startY = 0;
		let endX = 0;
		let endY = 0;
		const boxChoose = document.createElement('div');

		// 设置鼠标按下事件
		this.bindHandelEvent((event) => {
			flag = true;
			startX = event.position.x;
			startY = event.position.y;
			boxChoose.style.cssText = `
						position:absolute;
						width:0px;
						height:0px;
						margin:0px;
						padding:0px;
						border:${options?.border || '1px dashed #0099FF'};
						background-color:${options?.backgroundColor || '#C3D5ED'};
						z-index:1000;
						opacity:${options?.opacity || '0.6'};
				`;
			boxChoose.style.left = `${startX}px`;
			boxChoose.style.top = `${startY}px`;
			document.body.appendChild(boxChoose);
			options.mouseDown && options.mouseDown(event, boxChoose);
		}, options?.downType || Cesium.ScreenSpaceEventType.RIGHT_DOWN);

		// 鼠标移动事件
		this.bindHandelEvent((event) => {
			if (flag) {
				endX = event.endPosition.x;
				endY = event.endPosition.y;
				boxChoose.style.left = `${Math.min(endX, startX)}px`;
				boxChoose.style.top = `${Math.min(endY, startY)}px`;
				boxChoose.style.width = `${Math.abs(endX - startX)}px`;
				boxChoose.style.height = `${Math.abs(endY - startY)}px`;
				options.mouseMove && options.mouseMove(event, boxChoose);
			}
		}, this.Cesium.ScreenSpaceEventType.MOUSE_MOVE);

		// 鼠标抬起事件
		this.bindHandelEvent((event) => {
			flag = false;
			options.mouseUp && options.mouseUp(event, boxChoose);
		}, options?.upType || Cesium.ScreenSpaceEventType.RIGHT_UP);
	}


	/**
	 * 禁止鼠标搜索操作
	 */
	banAllHandelEvent() {
		const screenSpaceCameraController = this.Scene.screenSpaceCameraController;
		screenSpaceCameraController.zoomEventTypes = [];
		screenSpaceCameraController.lookEventTypes = [];
		screenSpaceCameraController.tiltEventTypes = [];
		screenSpaceCameraController.rotateEventTypes = [];
	}

	/**
	 * 设置雨天场景
	 * @returns {PostProcessStage | PostProcessStageComposite}
	 */
	setRainEffect(name = 'rainEffect') {
		return this.Scene.postProcessStages.add(new this.Cesium.PostProcessStage({
			name,
			fragmentShader: `
							uniform sampler2D colorTexture;
							varying vec2 v_textureCoordinates;
							float hash(float x){
								return fract(sin(x*23.3)*13.13);
							}
							void main(){
								float time = czm_frameNumber / 60.0;
								vec2 resolution = czm_viewport.zw;
								vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
								vec3 c=vec3(.6,.7,.8);
								float a=-.4;
								float si=sin(a),co=cos(a);
								uv*=mat2(co,-si,si,co);
								uv*=length(uv+vec2(0,4.9))*.3+1.;
								float v=1.-sin(hash(floor(uv.x*100.))*2.);
								float b=clamp(abs(sin(20.*time*v+uv.y*(5./(2.+v))))-.95,0.,1.)*20.;
								c*=v*b;
								 gl_FragColor = mix(texture2D(colorTexture, v_textureCoordinates), vec4(c, 1), 0.2);
							}
					`
		}));
	}

	/**
	 * 设置雪天场景
	 * @returns {PostProcessStage | PostProcessStageComposite}
	 */
	setSnowEffect(name = 'snowEffect') {
		return this.Scene.postProcessStages.add(new this.Cesium.PostProcessStage({
			name,
			fragmentShader: `
							uniform sampler2D colorTexture;
							varying vec2 v_textureCoordinates;
							float snow(vec2 uv,float scale) {
									 float time = czm_frameNumber / 60.0;
									 float w=smoothstep(1.,0.,-uv.y*(scale/10.));
									 if(w<.1)return 0.;
									 uv+=time/scale;
									 uv.y+=time*2./scale;
									 uv.x+=sin(uv.y+time*.5)/scale;
									 uv*=scale;
									 vec2 s=floor(uv),f=fract(uv),p;
									 float k=3.,d;
									 p=.5+.35*sin(11.*fract(sin((s+p+scale)*mat2(7,3,6,5))*5.))-f;
									 d=length(p);
									 k=min(d,k);
									 k=smoothstep(0.,k,sin(f.x+f.y)*0.01);
									 return k*w;
							}
							void main(){
									vec2 resolution = czm_viewport.zw;
									vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
									vec3 finalColor=vec3(0);
									float c = 0.0;
									c+=snow(uv,30.)*.0;
									c+=snow(uv,20.)*.0;
									c+=snow(uv,15.)*.0;
									c+=snow(uv,10.);
									c+=snow(uv,8.);
									c+=snow(uv,6.);
									c+=snow(uv,5.);
									finalColor=(vec3(c));
									gl_FragColor = mix(texture2D(colorTexture, v_textureCoordinates), vec4(finalColor,1), 0.3);
							}
					`
		}));
	}

	/**
	 * 删除场景特效
	 * @param stage
	 */
	removeSceneEffect(stage) {
		this.Scene.postProcessStages.remove(stage);
	}

	/**
	 * 将屏幕坐标系转为世界坐标系
	 * @param x
	 * @param y
	 * @returns {Cartesian3}
	 */
	transformPositionToCartesian(x, y) {
		const pick = new this.Cesium.Cartesian2(x, y);
		return this.Scene.globe.pick(this.Camera.getPickRay(pick), this.Scene);
	}

	/**
	 * 将屏幕坐标系转换为经纬度
	 * @param position
	 * @returns {number[lon, lat]}
	 */
	transformPositionToLngAndLat(position) {
		// 将屏幕坐标系转为世界坐标系
		const earthPosition = this.Camera.pickEllipsoid(
			position,
			this.Scene.globe.ellipsoid
		);
		const cartographic = Cesium.Cartographic.fromCartesian(
			earthPosition,
			this.Scene.globe.ellipsoid,
			new Cesium.Cartographic()
		);
		const lat = Cesium.Math.toDegrees(cartographic.latitude);
		const lon = Cesium.Math.toDegrees(cartographic.longitude);
		return [lon, lat];
	}

	/**
	 * 添加多个实体
	 * @param entities
	 * @returns {*[]}
	 */
	addEntities(...entities) {
		return entities.map(entity => this.Viewer.entities.add(entity));
	}

	/**
	 * 根据多个ID返回对应的实体
	 * @param entityIds
	 * @returns {*[]}
	 */
	getEntitiesByIds(...entityIds) {
		return entityIds.map(id => this.Viewer.entities.getById(id));
	}

	/**
	 * 删除多个实体
	 * @param entities
	 */
	removeEntities(...entities) {
		entities.forEach(entity => this.Viewer.entities.remove(entity));
	}

	/**
	 * 创建点 Point
	 * @param options
	 * @returns {*}
	 */
	createPoint(options = {
		id: '',
		name: '',
		position: null

	}) {
		return this.Viewer.entities.add({
			id: options || new Date().getTime(),
			name: 'point'
		});
	}

}