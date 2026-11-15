// =====================================================================================================
//  Universe Aura – FF compatible (particles only)
//
//  Self-contained editor script. Copy this ONE file into an Editor folder of any Unity 2018.4+ project
//  (Built-in render pipeline, e.g. the .fab exporter project) and run:
//      Tools > Universe > Create Universe Aura (FF Compatible)
//
//  It bakes its own textures, creates materials and saves  Assets/Universe_Effect/Effect_UniverseAura.prefab
//  following the rules seen in the .fab sample (MutationEffectLibrary):
//      - only GameObject / Transform / ParticleSystem / ParticleSystemRenderer (no scripts, no meshes)
//      - materials use the built-in "Particles/Standard Unlit" shader
//      - max 30 particles per system, small textures
//  All motion (planets orbiting, spinning, comets) is done by particle modules
//  (Orbital Velocity, Texture Sheet Animation, Trails).
//
//  In a URP project the materials use "Universal Render Pipeline/Particles/Unlit" instead, for preview only.
//  Re-run the menu inside the Built-in project to switch the materials back before exporting.
//
//  Written for C# 7.3 / Unity 2018.4 API.
// =====================================================================================================
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

namespace UniverseFX.FF
{
    public static class UniverseAuraFFBuilder
    {
        const string Root = "Assets/Universe_Effect";
        const string TexDir = Root + "/Textures";
        const string MatDir = Root + "/Materials";
        const string PrefabName = "Effect_UniverseAura";
        const string PrefabPath = Root + "/" + PrefabName + ".prefab";

        enum BlendKind { Additive, Fade }

        class Kit
        {
            public Material disc, cloud, sparkle, glow, trail, sun, earth, saturn;
        }

        // ================================================================== menu

        [MenuItem("Tools/Universe/Create Universe Aura (FF Compatible)", false, 2)]
        public static void Create()
        {
            if (AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath) != null &&
                !EditorUtility.DisplayDialog("Universe Aura (FF)", PrefabPath + " already exists. Rebuild it?", "Rebuild", "Cancel"))
                return;
            Build(true, false);
        }

        /// <summary>
        /// Builds the prefab without dialogs or scene instances (for exporters / batch mode), with materials on the
        /// built-in "Particles/Standard Unlit" shader even in a URP project. Returns the prefab path.
        /// Call <see cref="SetMaterialsBuiltin"/>(false) afterwards to get the URP preview materials back.
        /// </summary>
        public static string BuildForExport()
        {
            Build(false, true);
            return PrefabPath;
        }

        /// <summary>Switches the existing materials between built-in (export) and the current pipeline (preview).</summary>
        public static void SetMaterialsBuiltin(bool builtin)
        {
            BuildMaterials(builtin);
            AssetDatabase.SaveAssets();
        }

        static void Build(bool interactive, bool forceBuiltin)
        {
            EnsureFolder(TexDir);
            EnsureFolder(MatDir);

            Kit kit;
            try
            {
                EditorUtility.DisplayProgressBar("Universe Aura (FF)", "Baking textures...", 0.2f);
                BakeTextures();
                kit = BuildMaterials(forceBuiltin);
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
            AssetDatabase.SaveAssets();

            GameObject aura = BuildAura(kit);
            if (!interactive)
            {
                PrefabUtility.SaveAsPrefabAsset(aura, PrefabPath);
                Object.DestroyImmediate(aura);
                AssetDatabase.SaveAssets();
                return;
            }

            Transform parent = Selection.activeTransform;
            if (parent != null)
            {
                aura.transform.SetParent(parent, false);
                aura.transform.localPosition = Vector3.zero;
            }

            PrefabUtility.SaveAsPrefabAssetAndConnect(aura, PrefabPath, InteractionMode.AutomatedAction);
            Undo.RegisterCreatedObjectUndo(aura, "Create Universe Aura (FF)");
            Selection.activeGameObject = aura;

            Debug.Log("[Universe] FF aura saved to " + PrefabPath + " using shader '" + kit.glow.shader.name + "'." +
                      (UsingSrp() ? " (URP preview – re-run this menu in the Built-in 2018.4 project before exporting.)" : ""));
            if (!UsingSrp()) // in URP the preview materials are expected to fail the shader rule
                UniverseFFValidator.Validate(AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath));
        }

        // ================================================================== textures + materials

        static void BakeTextures()
        {
            SaveTexture("T_UA_Glow", 128, 128, BakeMask(128, 128, MaskGlow), false, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Sparkle", 128, 128, BakeMask(128, 128, MaskSparkle), false, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Cloud", 128, 128, BakeMask(128, 128, MaskCloud), false, TextureWrapMode.Clamp);
            SaveTexture("T_UA_NebulaDisc", 256, 256, BakeMask(256, 256, MaskNebulaDisc), false, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Trail", 128, 32, BakeMask(128, 32, MaskTrail), false, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Earth_8x8", 512, 512, BakeFlipbook(8, 64, EarthFrame), true, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Sun_4x4", 256, 256, BakeFlipbook(4, 64, SunFrame), true, TextureWrapMode.Clamp);
            SaveTexture("T_UA_Saturn", 128, 128, BakeSaturn(128), true, TextureWrapMode.Clamp);
        }

        static Kit BuildMaterials(bool forceBuiltin)
        {
            var k = new Kit();
            k.disc = Mat("M_UA_NebulaDisc", Tex("T_UA_NebulaDisc"), BlendKind.Additive, false, forceBuiltin);
            k.cloud = Mat("M_UA_Cloud", Tex("T_UA_Cloud"), BlendKind.Additive, false, forceBuiltin);
            k.sparkle = Mat("M_UA_Sparkle", Tex("T_UA_Sparkle"), BlendKind.Additive, false, forceBuiltin);
            k.glow = Mat("M_UA_Glow", Tex("T_UA_Glow"), BlendKind.Additive, false, forceBuiltin);
            k.trail = Mat("M_UA_Trail", Tex("T_UA_Trail"), BlendKind.Additive, false, forceBuiltin);
            k.sun = Mat("M_UA_Sun", Tex("T_UA_Sun_4x4"), BlendKind.Additive, true, forceBuiltin);
            k.earth = Mat("M_UA_Earth", Tex("T_UA_Earth_8x8"), BlendKind.Fade, true, forceBuiltin);
            k.saturn = Mat("M_UA_Saturn", Tex("T_UA_Saturn"), BlendKind.Fade, false, forceBuiltin);
            return k;
        }

        static Texture2D Tex(string name)
        {
            var t = AssetDatabase.LoadAssetAtPath<Texture2D>(TexDir + "/" + name + ".png");
            if (t == null) throw new InvalidOperationException("[Universe] Missing baked texture " + name + " – run Create first.");
            return t;
        }

        public static bool UsingSrp()
        {
#if UNITY_2019_3_OR_NEWER
            return GraphicsSettings.currentRenderPipeline != null;
#else
            return GraphicsSettings.renderPipelineAsset != null;
#endif
        }

        static Material Mat(string name, Texture2D tex, BlendKind blend, bool flipbookBlending, bool forceBuiltin)
        {
            string path = MatDir + "/" + name + ".mat";
            bool additive = blend == BlendKind.Additive;

            Shader shader = (!forceBuiltin && UsingSrp()) ? Shader.Find("Universal Render Pipeline/Particles/Unlit") : null;
            bool urp = shader != null;
            if (!urp) shader = Shader.Find("Particles/Standard Unlit");
            if (shader == null)
                throw new InvalidOperationException("[Universe] Shader 'Particles/Standard Unlit' not found.");

            Material m = AssetDatabase.LoadAssetAtPath<Material>(path);
            bool isNew = m == null;
            if (isNew) m = new Material(shader);
            else m.shader = shader;
            m.name = name;

            m.shaderKeywords = new string[0];
            m.SetOverrideTag("RenderType", "Transparent");
            m.SetFloat("_ZWrite", 0f);
            m.SetFloat("_Cull", 0f);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", additive ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);

            if (urp)
            {
                // Universal Render Pipeline/Particles/Unlit (preview only)
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", additive ? 2f : 0f);
                m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
                m.SetFloat("_DstBlendAlpha", additive ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.SetFloat("_FlipbookBlending", flipbookBlending ? 1f : 0f);
                if (flipbookBlending) m.EnableKeyword("_FLIPBOOKBLENDING_ON");
                m.SetTexture("_BaseMap", tex);
                m.SetColor("_BaseColor", Color.white);
            }
            else
            {
                // Particles/Standard Unlit – same setup as StandardParticlesShaderGUI (Fade = 2, Additive = 4)
                m.SetFloat("_Mode", additive ? 4f : 2f);
                m.SetFloat("_ColorMode", 0f);
                m.SetFloat("_BlendOp", (float)BlendOp.Add);
                m.EnableKeyword("_ALPHABLEND_ON");
                m.SetFloat("_FlipbookMode", flipbookBlending ? 1f : 0f);
                if (flipbookBlending) m.EnableKeyword("_REQUIRE_UV2");
                m.SetColor("_Color", Color.white);
            }
            m.SetTexture("_MainTex", tex);
            m.renderQueue = (int)RenderQueue.Transparent;

            if (isNew) AssetDatabase.CreateAsset(m, path);
            else EditorUtility.SetDirty(m);
            return m;
        }

        // ================================================================== prefab

        static GameObject BuildAura(Kit k)
        {
            var root = new GameObject(PrefabName).transform;

            NebulaDisc(root, k.disc);
            NebulaGlow(root, k.cloud);
            Stars(root, k.sparkle);
            StarDust(root, k.glow);

            // Planets: one particle each, kept alive and moved around the character by Orbital Velocity.
            //                       name       material  height  tilt                       radius  rad/s   size   spin frames
            Planet(root, "Sun",    k.sun,    1.55f, new Vector3(12f, 0f, 8f),    0.85f,  0.8f, 0.45f, 4, 12f);
            Planet(root, "Earth",  k.earth,  1.0f,  new Vector3(-10f, 0f, -14f), 1.0f,  -1.0f, 0.22f, 8, 8f);
            Planet(root, "Saturn", k.saturn, 0.55f, new Vector3(8f, 0f, 10f),    1.15f,  0.55f, 0.42f, 0, 0f);

            Comet(root, "Comet_A", k, 1.2f, new Vector3(35f, 0f, 15f), 1.25f, 3.5f, new Color(0.45f, 0.8f, 1f));
            Comet(root, "Comet_B", k, 0.9f, new Vector3(-40f, 0f, -25f), 0.95f, -3.0f, new Color(1f, 0.55f, 0.85f));

            return root.gameObject;
        }

        static void NebulaDisc(Transform root, Material mat)
        {
            ParticleSystem ps = NewPS("Nebula_Disc", root, mat, false);
            ps.transform.localPosition = new Vector3(0f, 0.03f, 0f);
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.HorizontalBillboard;

            var main = ps.main;
            main.duration = 6f;
            main.prewarm = true;
            main.startLifetime = 6f;
            main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(2.4f, 3.0f);
            main.startRotation = new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2f);
            main.startColor = RandomColor(new Color(0.95f, 0.35f, 0.85f, 0.8f), new Color(0.45f, 0.3f, 1f, 0.8f), new Color(0.25f, 0.6f, 1f, 0.8f));
            main.maxParticles = 4;

            var em = ps.emission;
            em.rateOverTime = 0.6f;
            DisableShape(ps);

            var rot = ps.rotationOverLifetime;
            rot.enabled = true;
            rot.z = new ParticleSystem.MinMaxCurve(0.35f, 0.7f);   // swirl

            FadeInOut(ps, 0.3f, 0.7f);
        }

        static void NebulaGlow(Transform root, Material mat)
        {
            ParticleSystem ps = NewPS("Nebula_Glow", root, mat, false);
            ps.transform.localPosition = new Vector3(0f, 1f, 0f);
            var main = ps.main;
            main.duration = 3.5f;
            main.prewarm = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(2.5f, 3.5f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.02f, 0.08f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.6f, 1.0f);
            main.startRotation = new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2f);
            main.startColor = RandomColor(new Color(0.9f, 0.3f, 0.8f, 0.45f), new Color(0.5f, 0.25f, 0.95f, 0.45f), new Color(0.2f, 0.5f, 1f, 0.45f));
            main.maxParticles = 10;

            var em = ps.emission;
            em.rateOverTime = 3f;
            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.55f;
            shape.scale = new Vector3(1f, 1.5f, 1f);

            var rot = ps.rotationOverLifetime;
            rot.enabled = true;
            rot.z = new ParticleSystem.MinMaxCurve(-0.4f, 0.4f);
            var size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0f, 0.7f, 1f, 1.1f));
            FadeInOut(ps, 0.3f, 0.7f);
        }

        static void Stars(Transform root, Material mat)
        {
            ParticleSystem ps = NewPS("Stars", root, mat, false);
            ps.transform.localPosition = new Vector3(0f, 1f, 0f);
            var main = ps.main;
            main.duration = 2f;
            main.prewarm = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(0.8f, 1.6f);
            main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.08f, 0.2f);
            main.startRotation = new ParticleSystem.MinMaxCurve(0f, 0.6f);
            main.startColor = RandomColor(Color.white, new Color(0.6f, 0.8f, 1f), new Color(1f, 0.85f, 0.55f));
            main.maxParticles = 20;

            var em = ps.emission;
            em.rateOverTime = 12f;
            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 1.1f;
            shape.radiusThickness = 0.4f;
            FadeInOut(ps, 0.3f, 0.6f);
        }

        static void StarDust(Transform root, Material mat)
        {
            ParticleSystem ps = NewPS("Star_Dust", root, mat, false);
            var main = ps.main;
            main.duration = 2.5f;
            main.prewarm = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(1.5f, 2.5f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.2f, 0.5f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.03f, 0.07f);
            main.startColor = RandomColor(new Color(0.7f, 0.85f, 1f), new Color(1f, 0.6f, 0.9f));
            main.maxParticles = 25;

            var em = ps.emission;
            em.rateOverTime = 10f;
            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = 8f;
            shape.radius = 0.9f;
            shape.radiusThickness = 0.4f;
            shape.rotation = new Vector3(-90f, 0f, 0f);
            FadeInOut(ps, 0.2f, 0.6f);
        }

        /// <summary>
        /// A single long-lived particle placed on a circle (radius) and carried around the system's Y axis
        /// by Orbital Velocity. The transform rotation tilts the orbit plane.
        /// Spin comes from a looping flipbook (frames of the planet rotating 360°).
        /// </summary>
        static void Planet(Transform root, string name, Material mat, float height, Vector3 tilt, float radius,
            float radPerSec, float size, int tiles, float spinPeriod)
        {
            ParticleSystem ps = Orbiter(name, root, mat, tiles > 0, height, tilt, radius, radPerSec);
            const float life = 600f; // respawns (at a random point on the orbit) only every 10 minutes
            var main = ps.main;
            main.duration = 5f;
            main.startLifetime = life;
            main.startSize = size;
            main.startColor = Color.white;
            main.maxParticles = 1;
            FadeInOut(ps, 0.0005f, 0.9995f);

            if (tiles > 0)
            {
                var ts = ps.textureSheetAnimation;
                ts.enabled = true;
                ts.mode = ParticleSystemAnimationMode.Grid;
                ts.numTilesX = tiles;
                ts.numTilesY = tiles;
                ts.animation = ParticleSystemAnimationType.WholeSheet;
                ts.frameOverTime = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0f, 0f, 1f, 1f));
                ts.cycleCount = Mathf.Max(1, Mathf.RoundToInt(life / spinPeriod));
            }
        }

        static void Comet(Transform root, string name, Kit k, float height, Vector3 tilt, float radius, float radPerSec, Color color)
        {
            ParticleSystem ps = Orbiter(name, root, k.glow, false, height, tilt, radius, radPerSec);
            var main = ps.main;
            main.duration = 2f;
            main.startLifetime = new ParticleSystem.MinMaxCurve(3f, 5f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.14f, 0.18f);
            main.startColor = Color.Lerp(color, Color.white, 0.5f);
            main.maxParticles = 1;
            FadeInOut(ps, 0.08f, 0.85f);

            var trails = ps.trails;
            trails.enabled = true;
            trails.mode = ParticleSystemTrailMode.PerParticle;
            trails.ratio = 1f;
            trails.lifetime = 0.1f;               // fraction of particle lifetime
            trails.minVertexDistance = 0.03f;
            trails.textureMode = ParticleSystemTrailTextureMode.Stretch;
            trails.worldSpace = false;
            trails.dieWithParticles = true;
            trails.sizeAffectsWidth = true;
            trails.inheritParticleColor = false;
            trails.widthOverTrail = new ParticleSystem.MinMaxCurve(0.5f, AnimationCurve.Linear(0f, 1f, 1f, 0.2f));
            trails.colorOverLifetime = new ParticleSystem.MinMaxGradient(Color.white);
            trails.colorOverTrail = new ParticleSystem.MinMaxGradient(Grad(new[] { Color.white, color, color }, 0f, 1f, 0.5f, 0.7f, 1f, 0f));

            ps.GetComponent<ParticleSystemRenderer>().trailMaterial = k.trail;
        }

        static ParticleSystem Orbiter(string name, Transform root, Material mat, bool flipbook, float height, Vector3 tilt,
            float radius, float radPerSec)
        {
            ParticleSystem ps = NewPS(name, root, mat, flipbook);
            ps.transform.localPosition = new Vector3(0f, height, 0f);
            ps.transform.localRotation = Quaternion.Euler(tilt);

            var main = ps.main;
            main.startSpeed = 0f;
            var em = ps.emission;
            em.rateOverTime = 10f; // with maxParticles = 1, a new one appears as soon as the old one dies

            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Circle;
            shape.radius = radius;
            shape.radiusThickness = 0f;            // on the edge of the circle
            shape.arc = 360f;
            shape.rotation = new Vector3(90f, 0f, 0f); // circle lies in the XZ plane (orbit plane)

            var vel = ps.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.Local;
            vel.x = 0f;
            vel.y = 0f;
            vel.z = 0f;
            vel.orbitalX = 0f;
            vel.orbitalY = radPerSec;
            vel.orbitalZ = 0f;
            vel.radial = 0f;
            return ps;
        }

        // ================================================================== particle helpers

        static ParticleSystem NewPS(string name, Transform parent, Material mat, bool flipbookBlending)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);

            var main = ps.main;
            main.loop = true;
            main.playOnAwake = true;
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            main.scalingMode = ParticleSystemScalingMode.Hierarchy;

            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = mat;
            r.renderMode = ParticleSystemRenderMode.Billboard;
            r.shadowCastingMode = ShadowCastingMode.Off;
            r.receiveShadows = false;
            r.lightProbeUsage = LightProbeUsage.Off;
            r.reflectionProbeUsage = ReflectionProbeUsage.Off;
            var streams = new List<ParticleSystemVertexStream>
            {
                ParticleSystemVertexStream.Position,
                ParticleSystemVertexStream.Color,
                ParticleSystemVertexStream.UV,
            };
            if (flipbookBlending)
            {
                streams.Add(ParticleSystemVertexStream.UV2);
                streams.Add(ParticleSystemVertexStream.AnimBlend);
            }
            r.SetActiveVertexStreams(streams);
            return ps;
        }

        static void DisableShape(ParticleSystem ps)
        {
            var shape = ps.shape;
            shape.enabled = false;
        }

        static void FadeInOut(ParticleSystem ps, float fadeInEnd, float fadeOutStart)
        {
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = new ParticleSystem.MinMaxGradient(Grad(new[] { Color.white, Color.white },
                0f, 0f, fadeInEnd, 1f, fadeOutStart, 1f, 1f, 0f));
        }

        static ParticleSystem.MinMaxGradient RandomColor(params Color[] colors)
        {
            var alphas = new List<float>();
            for (int i = 0; i < colors.Length; i++)
            {
                alphas.Add(colors.Length == 1 ? 0f : i / (float)(colors.Length - 1));
                alphas.Add(colors[i].a);
            }
            var g = new ParticleSystem.MinMaxGradient(Grad(colors, alphas.ToArray()));
            g.mode = ParticleSystemGradientMode.RandomColor;
            return g;
        }

        /// <summary>Colors are spread evenly; alphaKeys are (time, alpha) pairs.</summary>
        static Gradient Grad(Color[] colors, params float[] alphaKeys)
        {
            if (colors.Length == 1) colors = new[] { colors[0], colors[0] };
            var ck = new GradientColorKey[colors.Length];
            for (int i = 0; i < colors.Length; i++)
                ck[i] = new GradientColorKey(colors[i], i / (float)(colors.Length - 1));

            GradientAlphaKey[] ak;
            if (alphaKeys == null || alphaKeys.Length < 2)
                ak = new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(1f, 1f) };
            else
            {
                ak = new GradientAlphaKey[alphaKeys.Length / 2];
                for (int i = 0; i < ak.Length; i++)
                    ak[i] = new GradientAlphaKey(alphaKeys[i * 2 + 1], alphaKeys[i * 2]);
            }
            var g = new Gradient();
            g.SetKeys(ck, ak);
            return g;
        }

        // ================================================================== texture baking

        static readonly Vector3 LightDir = new Vector3(-0.5f, 0.5f, 0.7f).normalized;

        /// <summary>Grayscale mask → RGBA (rgb white, alpha = mask). x,y in [-1,1] (u,v for non-square).</summary>
        static Color[] BakeMask(int w, int h, Func<float, float, float> mask)
        {
            var px = new Color[w * h];
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float u = (x + 0.5f) / w, v = (y + 0.5f) / h;
                float a = Mathf.Clamp01(mask(u, v));
                px[y * w + x] = new Color(1f, 1f, 1f, a);
            }
            return px;
        }

        static float MaskGlow(float u, float v)
        {
            float x = u * 2f - 1f, y = v * 2f - 1f;
            float r = Mathf.Sqrt(x * x + y * y);
            return Mathf.Exp(-r * r * 5f) * (1f - SmoothStep(0.75f, 1f, r));
        }

        static float MaskSparkle(float u, float v)
        {
            float x = Mathf.Abs(u * 2f - 1f), y = Mathf.Abs(v * 2f - 1f);
            float r = Mathf.Sqrt(x * x + y * y);
            float core = Mathf.Exp(-r * r * 60f);
            float halo = Mathf.Exp(-r * r * 12f) * 0.35f;
            float rays = Mathf.Exp(-y * 45f) * (1f - x) + Mathf.Exp(-x * 45f) * (1f - y);
            float dx = Mathf.Abs(x - y) * 0.7071f;
            float diag = Mathf.Exp(-dx * 60f) * Mathf.Max(0f, 1f - r * 1.6f) * 0.5f;
            return (core + halo + rays * 0.9f + diag) * (1f - SmoothStep(0.9f, 1f, r));
        }

        static float MaskCloud(float u, float v)
        {
            float x = u * 2f - 1f, y = v * 2f - 1f;
            float r = Mathf.Sqrt(x * x + y * y);
            float n = Fbm(new Vector3(x * 2.5f + 3f, y * 2.5f + 7f, 1.3f), 5);
            return SmoothStep(0.3f, 0.75f, n) * Mathf.Exp(-r * r * 2.5f) * (1f - SmoothStep(0.7f, 1f, r)) * 1.3f;
        }

        static float MaskNebulaDisc(float u, float v)
        {
            float x = u * 2f - 1f, y = v * 2f - 1f;
            float r = Mathf.Sqrt(x * x + y * y);
            float th = Mathf.Atan2(y, x);
            float spiral = 0.5f + 0.5f * Mathf.Cos(2f * (th + r * 5f));
            // rotate the noise lookup with the spiral so clouds follow the arms
            float a = r * 5f;
            float cx = Mathf.Cos(a) * x - Mathf.Sin(a) * y, cy = Mathf.Sin(a) * x + Mathf.Cos(a) * y;
            float n = Fbm(new Vector3(cx * 3f + 11f, cy * 3f + 5f, 2.7f), 5);
            float clouds = SmoothStep(0.35f, 0.75f, n);
            float radial = (1f - SmoothStep(0.55f, 1f, r)) * SmoothStep(0.04f, 0.25f, r);
            float stars = Mathf.Pow(ValueNoise(new Vector3(x * 60f, y * 60f, 9f)), 18f) * 3f;
            return ((0.25f + 0.75f * spiral) * clouds * 1.4f + stars) * radial;
        }

        static float MaskTrail(float u, float v)
        {
            // U along the trail (bright at U = 0 = the particle/head, fading out), V across the width.
            float across = 1f - Mathf.Abs(v * 2f - 1f);
            float along = Mathf.Pow(1f - u, 1.4f);
            return Mathf.Pow(across, 1.5f) * along + Mathf.Pow(across, 8f) * along * along * 0.8f;
        }

        // ---------------- flipbooks / planets

        delegate Color FrameBaker(float x, float y, float t); // x,y in [-1,1], t = frame phase 0..1

        static Color[] BakeFlipbook(int tiles, int frameSize, FrameBaker baker)
        {
            int w = tiles * frameSize;
            var px = new Color[w * w];
            int frames = tiles * tiles;
            for (int f = 0; f < frames; f++)
            {
                int col = f % tiles, row = f / tiles;           // frame 0 = top-left
                int ox = col * frameSize, oy = (tiles - 1 - row) * frameSize;
                float t = f / (float)frames;
                for (int y = 0; y < frameSize; y++)
                for (int x = 0; x < frameSize; x++)
                {
                    float fx = (x + 0.5f) / frameSize * 2f - 1f;
                    float fy = (y + 0.5f) / frameSize * 2f - 1f;
                    px[(oy + y) * w + ox + x] = baker(fx, fy, t);
                }
            }
            return px;
        }

        static Color EarthFrame(float x, float y, float t)
        {
            const float R = 0.82f;
            const float pixel = 2f / 64f;
            float d = Mathf.Sqrt(x * x + y * y);
            Color atmo = new Color(0.35f, 0.65f, 1f);

            if (d > R)
            {
                // thin atmosphere halo, brighter on the lit side
                float h = 1f - (d - R) / (0.98f - R);
                if (h <= 0f) return new Color(atmo.r, atmo.g, atmo.b, 0f);
                float lit = Mathf.Clamp01(Vector3.Dot(new Vector3(x, y, 0f).normalized, LightDir) + 0.6f);
                return new Color(atmo.r, atmo.g, atmo.b, h * h * 0.7f * lit);
            }

            Vector3 n = new Vector3(x / R, y / R, Mathf.Sqrt(Mathf.Max(0f, 1f - d * d / (R * R))));
            // planet space: undo axial tilt, then spin around the planet's Y axis
            Vector3 dir = Quaternion.Euler(0f, t * 360f, 0f) * (Quaternion.Euler(0f, 0f, -23.4f) * n);
            Color c = EarthSurface(dir);
            float diff = Mathf.Clamp01(Vector3.Dot(n, LightDir));
            float rim = Mathf.Pow(1f - n.z, 3f);
            Color col = c * (diff * 1.15f + 0.12f) + atmo * rim * Mathf.Clamp01(diff + 0.3f) * 1.2f;
            col.a = Mathf.Clamp01((R - d) / pixel + 0.5f);
            return col;
        }

        static Color SunFrame(float x, float y, float t)
        {
            const float R = 0.5f;
            float d = Mathf.Sqrt(x * x + y * y);
            if (d > R)
            {
                float k = (d - R) / (1f - R);                     // 0 at the surface, 1 at the frame edge
                float halo = Mathf.Exp(-k * 4.5f) * (1f - SmoothStep(0.7f, 1f, k));
                return new Color(1f, 0.6f, 0.2f, halo * 0.85f);
            }
            Vector3 n = new Vector3(x / R, y / R, Mathf.Sqrt(Mathf.Max(0f, 1f - d * d / (R * R))));
            Vector3 dir = Quaternion.Euler(0f, t * 360f, 0f) * n;
            Vector3 p = dir * 3.5f;
            float n1 = Fbm(p, 5);
            float n2 = Fbm(p * 2.6f + Vector3.one * (n1 * 2f), 4);
            float g = Mathf.Clamp01(n1 * 0.7f + n2 * 0.6f - 0.2f);
            Color c = Color.Lerp(new Color(1f, 0.42f, 0.08f), new Color(1f, 0.95f, 0.7f), SmoothStep(0.25f, 0.7f, g));
            float limb = Mathf.Pow(1f - n.z, 2f);
            c = Color.Lerp(c, new Color(1f, 0.55f, 0.15f), limb * 0.7f);
            float cover = Mathf.Clamp01((R - d) / (2f / 64f) + 0.5f);
            c.a = cover + 0.85f * (1f - cover); // blend into the halo at the edge
            return c;
        }

        static Color[] BakeSaturn(int size)
        {
            const float R = 0.36f, ringIn = 0.45f, ringOut = 0.92f;
            float pixel = 2f / size;
            // ring plane normal seen from ~25° above, rolled a bit
            Vector3 ringN = Quaternion.Euler(0f, 0f, -16f) * (Quaternion.Euler(25f, 0f, 0f) * Vector3.up);
            Quaternion toPlanet = Quaternion.FromToRotation(ringN, Vector3.up);

            var px = new Color[size * size];
            for (int iy = 0; iy < size; iy++)
            for (int ix = 0; ix < size; ix++)
            {
                float x = (ix + 0.5f) / size * 2f - 1f;
                float y = (iy + 0.5f) / size * 2f - 1f;
                float d = Mathf.Sqrt(x * x + y * y);

                // planet
                Color planet = new Color(0f, 0f, 0f, 0f);
                float zs = -10f;
                if (d < R + pixel)
                {
                    zs = Mathf.Sqrt(Mathf.Max(0f, R * R - d * d));
                    Vector3 n = new Vector3(x, y, zs) / R;
                    Color c = SaturnSurface(toPlanet * n);
                    float diff = Mathf.Clamp01(Vector3.Dot(n, LightDir));
                    planet = c * (diff * 1.15f + 0.1f) + new Color(1f, 0.85f, 0.6f) * Mathf.Pow(1f - n.z, 3f) * 0.4f;
                    planet.a = Mathf.Clamp01((R - d) / pixel + 0.5f);
                }

                // ring (orthographic ray along -Z hits the plane through the centre)
                Color ring = new Color(0f, 0f, 0f, 0f);
                float zp = -(ringN.x * x + ringN.y * y) / ringN.z;
                Vector3 p = new Vector3(x, y, zp);
                float pr = p.magnitude;
                if (pr >= ringIn && pr <= ringOut)
                {
                    ring = RingColor((pr - ringIn) / (ringOut - ringIn));
                    float bright = 0.55f + 0.45f * Mathf.Abs(Vector3.Dot(ringN, LightDir));
                    // planet shadow on the ring
                    float along = Vector3.Dot(p, LightDir);
                    float off = (p - along * LightDir).magnitude;
                    if (along < 0f && off < R) bright *= 0.3f;
                    ring.r *= bright; ring.g *= bright; ring.b *= bright;
                }

                Color outCol;
                if (planet.a > 0f && ring.a > 0f && zp > zs)       // ring in front of the planet
                    outCol = Over(ring, planet);
                else if (planet.a > 0f && ring.a > 0f)             // ring behind the planet
                    outCol = Over(planet, ring);
                else if (planet.a > 0f)
                    outCol = planet;
                else
                    outCol = ring;
                px[iy * size + ix] = outCol;
            }
            return px;
        }

        static Color Over(Color top, Color bottom)
        {
            float a = top.a + bottom.a * (1f - top.a);
            if (a <= 0f) return new Color(0f, 0f, 0f, 0f);
            Color c = (top * top.a + bottom * bottom.a * (1f - top.a)) / a;
            c.a = a;
            return c;
        }

        static Color EarthSurface(Vector3 d)
        {
            Vector3 p = d * 2.2f + new Vector3(3.7f, 3.7f, 3.7f);
            float h = Fbm(p, 5);
            float land = SmoothStep(0.52f, 0.535f, h);
            Color ocean = Color.Lerp(new Color(0.02f, 0.08f, 0.3f), new Color(0.05f, 0.32f, 0.62f), SmoothStep(0.42f, 0.52f, h));
            float elev = Mathf.Clamp01((h - 0.52f) / 0.18f);
            float variation = Fbm(p * 3.3f + Vector3.one * 2.1f, 3);
            Color ground = Color.Lerp(new Color(0.15f, 0.45f, 0.1f), new Color(0.62f, 0.5f, 0.28f),
                Mathf.Clamp01(elev * 1.3f + (variation - 0.5f) * 0.8f));
            Color c = Color.Lerp(ocean, ground, land);
            float lat = Mathf.Abs(d.y) + (Fbm(p * 2f + Vector3.one * 5f, 3) - 0.5f) * 0.12f;
            c = Color.Lerp(c, new Color(0.92f, 0.95f, 1f), SmoothStep(0.82f, 0.85f, lat));
            float clouds = SmoothStep(0.53f, 0.66f, Fbm(d * 3.7f + new Vector3(40f, 40f, 40f), 4)) * 0.85f;
            return Color.Lerp(c, Color.white, clouds);
        }

        static Color SaturnSurface(Vector3 d)
        {
            Vector3 wp = new Vector3(d.x, d.y * 3f, d.z) * 2f + new Vector3(5.1f, 5.1f, 5.1f);
            float warp = Fbm(wp, 4) - 0.5f;
            float b = d.y * 18f + warp * 4f;
            float b1 = Mathf.Sin(b) * 0.5f + 0.5f;
            float b2 = Mathf.Sin(b * 2.37f + 1.3f) * 0.5f + 0.5f;
            Color c = Color.Lerp(new Color(0.9f, 0.78f, 0.55f), new Color(0.66f, 0.52f, 0.33f), b1);
            c = Color.Lerp(c, new Color(0.98f, 0.92f, 0.74f), b2 * 0.5f);
            c *= 0.85f + 0.3f * Fbm(wp * 3f, 3);
            c *= Mathf.Lerp(1f, 0.65f, SmoothStep(0.7f, 1f, Mathf.Abs(d.y)));
            c.a = 1f;
            return c;
        }

        static Color RingColor(float r)
        {
            float n1 = Fbm(new Vector3(r * 30f, 1.3f, 0f), 4);
            float n2 = ValueNoise(new Vector3(r * 210f, 6.3f, 0f));
            float dens = Mathf.Clamp01((n1 - 0.3f) * 2.2f) * (0.65f + 0.35f * n2);
            float gap = 1f - SmoothStep(0.0175f, 0.035f, Mathf.Abs(r - 0.62f));
            dens *= (1f - gap) * SmoothStep(0f, 0.05f, r) * (1f - SmoothStep(0.93f, 1f, r));
            Color c = Color.Lerp(new Color(0.62f, 0.54f, 0.42f), new Color(0.95f, 0.88f, 0.7f), r) * (0.75f + 0.5f * n1);
            c.a = Mathf.Clamp01(dens * 0.95f);
            return c;
        }

        static Texture2D SaveTexture(string name, int w, int h, Color[] px, bool sRGB, TextureWrapMode wrap)
        {
            string path = TexDir + "/" + name + ".png";
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            tex.SetPixels(px);
            tex.Apply();
            File.WriteAllBytes(Path.GetFullPath(path), tex.EncodeToPNG());
            Object.DestroyImmediate(tex);

            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var imp = (TextureImporter)AssetImporter.GetAtPath(path);
            imp.textureType = TextureImporterType.Default;
            imp.sRGBTexture = sRGB;
            imp.alphaSource = TextureImporterAlphaSource.FromInput;
            imp.alphaIsTransparency = true;
            imp.mipmapEnabled = true;
            imp.wrapMode = wrap;
            imp.maxTextureSize = Mathf.Max(w, h);
            imp.textureCompression = TextureImporterCompression.Compressed;
            imp.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        // ---------------- tiny CPU noise

        static float Frac(float x) { return x - Mathf.Floor(x); }

        static float Hash13(Vector3 p)
        {
            p = new Vector3(Frac(p.x * 0.1031f), Frac(p.y * 0.1031f), Frac(p.z * 0.1031f));
            float d = Vector3.Dot(p, new Vector3(p.z, p.y, p.x) + Vector3.one * 31.32f);
            p += Vector3.one * d;
            return Frac((p.x + p.y) * p.z);
        }

        static float ValueNoise(Vector3 p)
        {
            var i = new Vector3(Mathf.Floor(p.x), Mathf.Floor(p.y), Mathf.Floor(p.z));
            Vector3 f = p - i;
            var u = new Vector3(f.x * f.x * (3 - 2 * f.x), f.y * f.y * (3 - 2 * f.y), f.z * f.z * (3 - 2 * f.z));
            float n000 = Hash13(i);
            float n100 = Hash13(i + new Vector3(1, 0, 0));
            float n010 = Hash13(i + new Vector3(0, 1, 0));
            float n110 = Hash13(i + new Vector3(1, 1, 0));
            float n001 = Hash13(i + new Vector3(0, 0, 1));
            float n101 = Hash13(i + new Vector3(1, 0, 1));
            float n011 = Hash13(i + new Vector3(0, 1, 1));
            float n111 = Hash13(i + new Vector3(1, 1, 1));
            return Mathf.Lerp(
                Mathf.Lerp(Mathf.Lerp(n000, n100, u.x), Mathf.Lerp(n010, n110, u.x), u.y),
                Mathf.Lerp(Mathf.Lerp(n001, n101, u.x), Mathf.Lerp(n011, n111, u.x), u.y), u.z);
        }

        static float Fbm(Vector3 p, int octaves)
        {
            float sum = 0f, amp = 0.5f, norm = 0f;
            for (int o = 0; o < octaves; o++)
            {
                sum += amp * ValueNoise(p);
                norm += amp;
                p = p * 2.02f + new Vector3(17.13f, 3.71f, 9.27f);
                amp *= 0.5f;
            }
            return sum / norm;
        }

        static float SmoothStep(float a, float b, float x)
        {
            float t = Mathf.Clamp01((x - a) / (b - a));
            return t * t * (3f - 2f * t);
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            int slash = path.LastIndexOf('/');
            string parent = path.Substring(0, slash);
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, path.Substring(slash + 1));
        }
    }
}
